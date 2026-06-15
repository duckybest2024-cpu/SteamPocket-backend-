import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireApproved, AuthedRequest } from "../middleware/auth";

export const eventsRouter = Router();

const HOST_TIERS = ["gold_patron", "platinum_patron", "diamond_patron", "netherite_patron"];
const HOST_CUT: Record<string, number> = {
  gold_patron: 5,
  platinum_patron: 10,
  diamond_patron: 15,
  netherite_patron: 20,
};
const MAX_PLAYERS_BY_TIER: Record<string, number> = {
  gold_patron: 50,
  platinum_patron: 100,
  diamond_patron: 200,
  netherite_patron: 1000,
};

async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, patreonTier: true, isApproved: true, isAdmin: true, balance: true },
  });
}

// GET /events — list open events
eventsRouter.get("/", requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: "open" },
      include: { participants: { select: { username: true, userId: true, joinedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ events });
  } catch {
    res.status(500).json({ error: "Failed to load events" });
  }
});

// GET /events/my — hosted events
eventsRouter.get("/my", requireAuth as any, requireApproved as any, async (req: AuthedRequest, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { hostId: req.userId! },
      include: { participants: { select: { username: true, userId: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ events });
  } catch {
    res.status(500).json({ error: "Failed to load your events" });
  }
});

// POST /events — create (Gold+)
const createSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(500).default(""),
  entryFee: z.number().int().min(0),
  maxPlayers: z.number().int().min(2).max(1000).default(50),
});

eventsRouter.post("/", requireAuth as any, requireApproved as any, async (req: AuthedRequest, res) => {
  const user = await getUser(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found" });

  const tier = user.patreonTier ?? "";
  if (!HOST_TIERS.includes(tier) && !user.isAdmin) {
    return res.status(403).json({ error: "Gold Patron or higher required to host events." });
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { title, description, entryFee, maxPlayers } = parsed.data;
  const hostCutPct = HOST_CUT[tier] ?? (user.isAdmin ? 10 : 5);
  const cap = MAX_PLAYERS_BY_TIER[tier] ?? (user.isAdmin ? 1000 : 50);

  try {
    const event = await prisma.event.create({
      data: {
        hostId: user.id,
        hostName: user.username,
        title,
        description,
        entryFee,
        maxPlayers: Math.min(maxPlayers, cap),
        hostCutPct,
      },
    });
    res.status(201).json({ event });
  } catch {
    res.status(500).json({ error: "Failed to create event" });
  }
});

// POST /events/:id/join
eventsRouter.post("/:id/join", requireAuth as any, requireApproved as any, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const user = await getUser(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    const event = await prisma.event.findUnique({ where: { id }, include: { participants: true } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.status !== "open") return res.status(400).json({ error: "Event is no longer open" });
    if (event.participants.length >= event.maxPlayers) return res.status(400).json({ error: "Event is full" });
    if (event.hostId === user.id) return res.status(400).json({ error: "Cannot join your own event" });
    if (event.participants.find((p) => p.userId === user.id)) return res.status(400).json({ error: "Already joined" });

    if (event.entryFee > 0) {
      if (user.balance < event.entryFee) return res.status(400).json({ error: "Insufficient balance" });
      const hostCut = Math.floor(event.entryFee * event.hostCutPct / 100);
      const toPrize = event.entryFee - hostCut;
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: event.entryFee } } }),
        prisma.user.update({ where: { id: event.hostId }, data: { balance: { increment: hostCut } } }),
        prisma.event.update({ where: { id }, data: { prizePool: { increment: toPrize }, hostEarned: { increment: hostCut } } }),
        prisma.eventParticipant.create({ data: { eventId: id, userId: user.id, username: user.username } }),
      ]);
    } else {
      await prisma.eventParticipant.create({ data: { eventId: id, userId: user.id, username: user.username } });
    }

    const updated = await prisma.event.findUnique({
      where: { id },
      include: { participants: { select: { username: true, userId: true, joinedAt: true } } },
    });
    res.json({ event: updated });
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(400).json({ error: "Already joined" });
    console.error("Join event error:", err);
    res.status(500).json({ error: "Failed to join event" });
  }
});

// POST /events/:id/complete — host draws a winner
eventsRouter.post("/:id/complete", requireAuth as any, requireApproved as any, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { winnerId } = req.body as { winnerId?: string };
  const user = await getUser(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    const event = await prisma.event.findUnique({ where: { id }, include: { participants: true } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.hostId !== user.id && !user.isAdmin) return res.status(403).json({ error: "Only the host can complete this event" });
    if (event.status !== "open") return res.status(400).json({ error: "Event already completed" });
    if (!event.participants.length) return res.status(400).json({ error: "No participants yet" });

    let winner = winnerId
      ? event.participants.find((p) => p.userId === winnerId)
      : event.participants[Math.floor(Math.random() * event.participants.length)];
    if (!winner) return res.status(400).json({ error: "Winner not found in participants" });

    await prisma.$transaction([
      prisma.user.update({ where: { id: winner.userId }, data: { balance: { increment: event.prizePool } } }),
      prisma.event.update({
        where: { id },
        data: { status: "completed", winnerId: winner.userId, winnerName: winner.username, completedAt: new Date() },
      }),
    ]);

    res.json({ winnerId: winner.userId, winnerName: winner.username, prizePool: event.prizePool });
  } catch (err) {
    console.error("Complete event error:", err);
    res.status(500).json({ error: "Failed to complete event" });
  }
});

// DELETE /events/:id — cancel and refund
eventsRouter.delete("/:id", requireAuth as any, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const user = await getUser(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    const event = await prisma.event.findUnique({ where: { id }, include: { participants: true } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.hostId !== user.id && !user.isAdmin) return res.status(403).json({ error: "Only the host can cancel" });
    if (event.status !== "open") return res.status(400).json({ error: "Event already completed or cancelled" });

    const ops: any[] = event.entryFee > 0
      ? event.participants.map((p) =>
          prisma.user.update({ where: { id: p.userId }, data: { balance: { increment: event.entryFee } } })
        )
      : [];
    if (event.hostEarned > 0) {
      ops.push(prisma.user.update({ where: { id: event.hostId }, data: { balance: { decrement: event.hostEarned } } }));
    }
    ops.push(prisma.event.update({ where: { id }, data: { status: "cancelled" } }));
    await prisma.$transaction(ops);

    res.json({ ok: true });
  } catch (err) {
    console.error("Cancel event error:", err);
    res.status(500).json({ error: "Failed to cancel event" });
  }
});
