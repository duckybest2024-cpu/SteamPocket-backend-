import { RequestHandler, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { isOwner } from "../lib/owner";

export const adminRouter = Router();

// ---------------------------------------------------------------------------
// Admin-only middleware: requireAuth + case-insensitive owner username check
// ---------------------------------------------------------------------------
const adminOnly: RequestHandler[] = [
  requireAuth as RequestHandler,
  async (req: AuthedRequest, res, next) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || (!isOwner(user.username) && !user.isAdmin)) {
      return res.status(403).json({ error: "Admin only" });
    }
    next();
  },
];

// Apply adminOnly to everything on this router
adminRouter.use(adminOnly);

// ---------------------------------------------------------------------------
// GET /admin/stats
// ---------------------------------------------------------------------------
adminRouter.get("/stats", async (_req, res) => {
  try {
    const [totalUsers, totalBets, betAgg, activeRoundsCount] = await Promise.all([
      prisma.user.count(),
      prisma.bet.count(),
      prisma.bet.aggregate({ _sum: { amount: true, payout: true } }),
      prisma.crashRound.count({ where: { state: { in: ["betting", "running"] } } }),
    ]);

    const totalWagered = betAgg._sum.amount ?? 0;
    const totalPaidOut = betAgg._sum.payout ?? 0;
    const houseEdgeRaw = totalWagered > 0 ? ((totalWagered - totalPaidOut) / totalWagered) * 100 : 0;
    const houseEdge = `${houseEdgeRaw.toFixed(2)}%`;

    res.json({ totalUsers, totalBets, totalWagered, totalPaidOut, houseEdge, activeRoundsCount });
  } catch (err) {
    console.error("GET /admin/stats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/users — paginated user list with optional search
// ---------------------------------------------------------------------------
adminRouter.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;

    const where = search ? { username: { contains: search } } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { _count: { select: { bets: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        balance: u.balance,
        bank: u.bank,
        level: u.level,
        xp: u.xp,
        isBanned: u.isBanned,
        createdAt: u.createdAt,
        betCount: u._count.bets,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /admin/users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/ban/:userId — toggle ban
// ---------------------------------------------------------------------------
adminRouter.post("/ban/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBanned: !user.isBanned },
    });

    res.json({ isBanned: updated.isBanned });
  } catch (err) {
    console.error("POST /admin/ban/:userId error:", err);
    res.status(500).json({ error: "Failed to update ban status" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/adjust-balance/:userId — add amount (can be negative) to balance
// ---------------------------------------------------------------------------
const adjustSchema = z.object({
  amount: z.number().int(),
  note: z.string().min(1),
});

adminRouter.post("/adjust-balance/:userId", async (req, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, note } = parsed.data;
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "admin_adjustment",
          amount,
          balance: u.balance,
          reference: note,
        },
      });
      return u;
    });

    res.json({ balance: updated.balance });
  } catch (err) {
    console.error("POST /admin/adjust-balance/:userId error:", err);
    res.status(500).json({ error: "Failed to adjust balance" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/users/:userId — hard delete user and all data
// ---------------------------------------------------------------------------
adminRouter.delete("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (isOwner(user.username)) {
      return res.status(403).json({ error: "Cannot delete the admin account" });
    }

    await prisma.$transaction([
      prisma.rakebackClaim.deleteMany({ where: { userId } }),
      prisma.seedRotation.deleteMany({ where: { userId } }),
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.bet.deleteMany({ where: { userId } }),
      prisma.friendRequest.deleteMany({ where: { OR: [{ fromId: userId }, { toId: userId }] } }),
      prisma.friendship.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/users/:userId error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ---------------------------------------------------------------------------
// GET /bank — house bank balance + P&L
// ---------------------------------------------------------------------------
adminRouter.get("/bank", async (_req, res) => {
  try {
    const bank = await prisma.houseBank.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", chips: 1000000000, dollars: 1000000000 },
      update: {},
    });

    const betAgg = await prisma.bet.aggregate({ _sum: { amount: true, payout: true } });
    const totalWagered = betAgg._sum.amount ?? 0;
    const totalPaidOut = betAgg._sum.payout ?? 0;
    const houseIncome = totalWagered - totalPaidOut;

    const transactions = await prisma.houseBankTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      chips: bank.chips,
      dollars: bank.dollars,
      houseIncome,
      totalWagered,
      totalPaidOut,
      transactions,
    });
  } catch (err) {
    console.error("GET /admin/bank error:", err);
    res.status(500).json({ error: "Failed to load bank" });
  }
});

// ---------------------------------------------------------------------------
// POST /bank/adjust — add/remove chips or dollars from house bank
// ---------------------------------------------------------------------------
const bankAdjustSchema = z.object({
  type: z.enum(["chips", "dollars"]),
  amount: z.number().int(),
  note: z.string().min(1),
});

adminRouter.post("/bank/adjust", async (req, res) => {
  const parsed = bankAdjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { type, amount, note } = parsed.data;

  try {
    const updateData = type === "chips" ? { chips: { increment: amount } } : { dollars: { increment: amount } };
    const bank = await prisma.houseBank.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", chips: type === "chips" ? 1000000000 + amount : 1000000000, dollars: type === "dollars" ? 1000000000 + amount : 1000000000 },
      update: updateData,
    });

    await prisma.houseBankTransaction.create({
      data: {
        type: amount >= 0 ? `${type}_add` : `${type}_remove`,
        chipsChange: type === "chips" ? amount : 0,
        dollarsChange: type === "dollars" ? amount : 0,
        note,
      },
    });

    res.json({ chips: bank.chips, dollars: bank.dollars });
  } catch (err) {
    console.error("POST /admin/bank/adjust error:", err);
    res.status(500).json({ error: "Failed to adjust bank" });
  }
});

// ---------------------------------------------------------------------------
// Owner-only middleware (only the hardcoded owner username can change ranks)
// ---------------------------------------------------------------------------
const ownerOnly: RequestHandler[] = [
  requireAuth as RequestHandler,
  async (req: AuthedRequest, res, next) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !isOwner(user.username)) {
      return res.status(403).json({ error: "Only the owner can change ranks" });
    }
    next();
  },
];

// ---------------------------------------------------------------------------
// PATCH /users/:userId/rank — set a user's rank (owner only)
// ---------------------------------------------------------------------------
const rankSchema = z.object({
  rank: z.enum(["newcomer","beginner","amateur","apprentice","bronze","silver","gold","platinum","diamond","emerald","sapphire","ruby","jade","crystal","elite","master","grandmaster","legend","titan","owner"]),
});

adminRouter.patch("/users/:userId/rank", ownerOnly, async (req: AuthedRequest, res: import("express").Response) => {
  const parsed = rankSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (isOwner(user.username)) return res.status(400).json({ error: "Cannot change owner rank" });

    const updated = await prisma.user.update({ where: { id: userId }, data: { rank: parsed.data.rank } });
    res.json({ rank: updated.rank });
  } catch (err) {
    console.error("PATCH /admin/users/:userId/rank error:", err);
    res.status(500).json({ error: "Failed to update rank" });
  }
});

// ── Feature 1 & 2: per-game stats + revenue chart ──────────────────────────

adminRouter.get("/stats/games", async (_req, res) => {
  try {
    const grouped = await prisma.bet.groupBy({
      by: ["game"],
      _sum: { amount: true, payout: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
    });
    res.json({
      games: grouped.map((g) => ({
        game: g.game,
        wagered: g._sum.amount ?? 0,
        paidOut: g._sum.payout ?? 0,
        bets: g._count._all,
        edge: g._sum.amount
          ? (((g._sum.amount - (g._sum.payout ?? 0)) / g._sum.amount) * 100).toFixed(2)
          : "0.00",
      })),
    });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/stats/revenue", async (_req, res) => {
  try {
    const days = 14;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const bets = await prisma.bet.findMany({
      where: { createdAt: { gte: since } },
      select: { amount: true, payout: true, createdAt: true },
    });
    const dailyMap: Record<string, { wagered: number; paidOut: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      dailyMap[d.toISOString().slice(0, 10)] = { wagered: 0, paidOut: 0 };
    }
    for (const bet of bets) {
      const key = bet.createdAt.toISOString().slice(0, 10);
      if (dailyMap[key]) { dailyMap[key].wagered += bet.amount; dailyMap[key].paidOut += bet.payout; }
    }
    res.json({ days: Object.entries(dailyMap).map(([date, { wagered, paidOut }]) => ({ date, wagered, paidOut, profit: wagered - paidOut })) });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Feature 3: active users ─────────────────────────────────────────────────

adminRouter.get("/stats/active", async (_req, res) => {
  try {
    const [h24, d7, d30] = await Promise.all([
      prisma.bet.groupBy({ by: ["userId"], where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
      prisma.bet.groupBy({ by: ["userId"], where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      prisma.bet.groupBy({ by: ["userId"], where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    ]);
    res.json({ last24h: h24.length, last7d: d7.length, last30d: d30.length });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Feature 4: user detail ──────────────────────────────────────────────────

adminRouter.get("/users/:id/detail", async (req, res) => {
  try {
    const { id } = req.params;
    const [user, bets, txs, nfts] = await Promise.all([
      prisma.user.findUnique({ where: { id }, include: { _count: { select: { bets: true, nfts: true } } } }),
      prisma.bet.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.nft.findMany({ where: { ownerId: id }, orderBy: { mintedAt: "desc" }, take: 20 }),
    ]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user, bets, txs, nfts });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Feature 5: zero balance ─────────────────────────────────────────────────

adminRouter.post("/users/:id/zero-balance", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Not found" });
    const delta = -user.balance;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: { balance: 0 } });
      if (delta !== 0) await tx.transaction.create({ data: { userId: id, type: "admin_zero", amount: delta, balance: 0, reference: "admin zero balance" } });
      return u;
    });
    res.json({ balance: updated.balance });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Feature 6: recent bets feed ─────────────────────────────────────────────

adminRouter.get("/bets", async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const bets = await prisma.bet.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { username: true } } },
    });
    res.json({ bets });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Feature 7: payment history ──────────────────────────────────────────────

adminRouter.get("/payments", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 50;
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { type: { in: ["deposit", "withdrawal", "promo"] } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { username: true } } },
      }),
      prisma.transaction.count({ where: { type: { in: ["deposit", "withdrawal", "promo"] } } }),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Feature 8 & 9: top players ──────────────────────────────────────────────

adminRouter.get("/top-players", async (_req, res) => {
  try {
    const grouped = await prisma.bet.groupBy({
      by: ["userId"],
      _sum: { amount: true, payout: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 20,
    });
    const userList = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, username: true, level: true },
    });
    const userMap = new Map(userList.map((u) => [u.id, u]));
    res.json({
      players: grouped.map((g) => ({
        username: userMap.get(g.userId)?.username ?? "unknown",
        level: userMap.get(g.userId)?.level ?? 1,
        wagered: g._sum.amount ?? 0,
        paidOut: g._sum.payout ?? 0,
        profit: (g._sum.payout ?? 0) - (g._sum.amount ?? 0),
        bets: g._count._all,
      })),
    });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Features 10 & 11: broadcasts ────────────────────────────────────────────

adminRouter.get("/broadcasts", async (_req, res) => {
  const broadcasts = await prisma.broadcast.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ broadcasts });
});

adminRouter.post("/broadcast", async (req, res) => {
  const { message, type = "info" } = req.body as { message?: string; type?: string };
  if (!message) return res.status(400).json({ error: "Message required" });
  const b = await prisma.broadcast.create({ data: { message, type } });
  res.json({ broadcast: b });
});

adminRouter.delete("/broadcasts/:id", async (req, res) => {
  try {
    await prisma.broadcast.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: "Not found" }); }
});

// ── Features 12, 13, 14: promo codes ────────────────────────────────────────

adminRouter.get("/promos", async (_req, res) => {
  const promos = await prisma.promoCode.findMany({
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ promos });
});

adminRouter.post("/promos", async (req, res) => {
  const { code, chips, maxUses = 1, expiresAt } = req.body as { code?: string; chips?: number; maxUses?: number; expiresAt?: string };
  if (!code || !chips) return res.status(400).json({ error: "code and chips required" });
  try {
    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase().trim(),
        chips: Math.round(Number(chips) * 100),
        maxUses: Number(maxUses) || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });
    res.json({ promo });
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "Code already exists" });
    res.status(500).json({ error: "Failed to create promo code" });
  }
});

adminRouter.delete("/promos/:id", async (req, res) => {
  try {
    await prisma.promoCode.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: "Not found" }); }
});

// ── Features 15 & 16: game controls + maintenance ───────────────────────────

adminRouter.get("/config", async (_req, res) => {
  const configs = await prisma.siteConfig.findMany();
  const obj: Record<string, string> = {};
  for (const c of configs) obj[c.key] = c.value;
  res.json(obj);
});

adminRouter.post("/config", async (req, res) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await prisma.siteConfig.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }
  res.json({ ok: true });
});

// ── Feature 17: bulk chip giveaway ──────────────────────────────────────────

adminRouter.post("/bulk-chips", async (req, res) => {
  const { chips, note = "bulk giveaway" } = req.body as { chips?: number; note?: string };
  if (!chips || Number(chips) <= 0) return res.status(400).json({ error: "chips must be > 0" });
  const chipsInCents = Math.round(Number(chips) * 100);
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    let count = 0;
    for (const u of users) {
      const updated = await prisma.user.update({ where: { id: u.id }, data: { balance: { increment: chipsInCents } } });
      await prisma.transaction.create({ data: { userId: u.id, type: "admin_bonus", amount: chipsInCents, balance: updated.balance, reference: note } });
      count++;
    }
    res.json({ count, chipsEach: Number(chips) });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// ── Features 18: site settings (starting balance) are stored in SiteConfig
// (already covered by GET/POST /admin/config above)

// ── Features 19 & 20: NFT management ────────────────────────────────────────

adminRouter.get("/nfts", async (_req, res) => {
  try {
    const nfts = await prisma.nft.findMany({
      orderBy: { mintedAt: "desc" },
      take: 100,
      include: { owner: { select: { username: true } } },
    });
    res.json({ nfts });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.post("/nft/mint", async (req, res) => {
  const { username, name, description = "", rarity = "common", category = "special", emoji = "⭐" } = req.body as { username?: string; name?: string; description?: string; rarity?: string; category?: string; emoji?: string };
  if (!username || !name) return res.status(400).json({ error: "username and name required" });
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const nft = await prisma.nft.create({ data: { ownerId: user.id, name, description: description || name, rarity, category, emoji } });
    res.json({ nft });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.delete("/nft/:id", async (req, res) => {
  try {
    await prisma.tradeOfferItem.deleteMany({ where: { nftId: req.params.id } });
    await prisma.nft.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: "Not found" }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// ANTI-CHEAT — flag management
// ──────────────────────────────────────────────────────────────────────────────

// GET /admin/flags — list all unresolved anticheat events with user info
adminRouter.get("/flags", async (_req, res) => {
  try {
    const events = await (prisma as any).anticheatEvent.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const userIds = [...new Set(events.map((e: any) => e.userId))] as string[];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, balance: true, flagged: true, flagReason: true, flaggedAt: true, isBanned: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json({
      events: events.map((e: any) => ({
        ...e,
        details: (() => { try { return JSON.parse(e.details); } catch { return {}; } })(),
        user: userMap.get(e.userId) ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /admin/flags error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /admin/flags/users — list flagged users
adminRouter.get("/flags/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { flagged: true },
      select: { id: true, username: true, email: true, balance: true, flagged: true, flagReason: true, flaggedAt: true, isBanned: true, createdAt: true },
      orderBy: { flaggedAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /admin/flags/:eventId/resolve — resolve a specific event
adminRouter.post("/flags/:eventId/resolve", async (req: AuthedRequest, res) => {
  const { resolution } = req.body as { resolution?: string };
  try {
    const event = await (prisma as any).anticheatEvent.update({
      where: { id: req.params.eventId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.userId,
        resolution: resolution || "dismissed",
      },
    });

    // If all events for user are resolved, unflag user
    const remaining = await (prisma as any).anticheatEvent.count({
      where: { userId: event.userId, resolved: false },
    });
    if (remaining === 0) {
      await prisma.user.update({ where: { id: event.userId }, data: { flagged: false, flagReason: null } });
    }

    res.json({ ok: true, event });
  } catch (err) {
    console.error("POST /admin/flags/:eventId/resolve error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /admin/flags/user/:userId/clear — clear all flags for a user
adminRouter.post("/flags/user/:userId/clear", async (req: AuthedRequest, res) => {
  try {
    await (prisma as any).anticheatEvent.updateMany({
      where: { userId: req.params.userId, resolved: false },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy: req.userId, resolution: "cleared_by_admin" },
    });
    await prisma.user.update({
      where: { id: req.params.userId },
      data: { flagged: false, flagReason: null, flaggedAt: null },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /admin/flags/user/:userId/ban — ban a flagged user
adminRouter.post("/flags/user/:userId/ban", async (req: AuthedRequest, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.userId },
      data: { isBanned: true, flagReason: "banned_by_admin" },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 1. MAINTENANCE MODE
// ===========================================================================
let maintenanceMode = false;

adminRouter.get("/maintenance", (_req, res) => {
  res.json({ enabled: maintenanceMode });
});

adminRouter.post("/maintenance/toggle", (_req, res) => {
  maintenanceMode = !maintenanceMode;
  res.json({ enabled: maintenanceMode });
});

// ===========================================================================
// 2. SITE CONFIG
// ===========================================================================
const siteConfig = {
  minBet: 10,
  maxBet: 100000,
  houseEdgeOverride: null as number | null,
};

adminRouter.get("/config", (_req, res) => {
  res.json(siteConfig);
});

adminRouter.post("/config", (req, res) => {
  const { minBet, maxBet, houseEdgeOverride } = req.body as {
    minBet?: number;
    maxBet?: number;
    houseEdgeOverride?: number | null;
  };
  if (minBet !== undefined) siteConfig.minBet = Number(minBet);
  if (maxBet !== undefined) siteConfig.maxBet = Number(maxBet);
  if (houseEdgeOverride !== undefined)
    siteConfig.houseEdgeOverride = houseEdgeOverride === null ? null : Number(houseEdgeOverride);
  res.json(siteConfig);
});

// ===========================================================================
// 3. IP BLOCKS
// ===========================================================================
const ipBlockList: Array<{ ip: string; reason: string; addedAt: string }> = [];

adminRouter.get("/ip-blocks", (_req, res) => {
  res.json({ blocks: ipBlockList });
});

adminRouter.post("/ip-blocks", (req, res) => {
  const { ip, reason } = req.body as { ip?: string; reason?: string };
  if (!ip) return res.status(400).json({ error: "IP required" });
  if (ipBlockList.find(b => b.ip === ip))
    return res.status(409).json({ error: "IP already blocked" });
  ipBlockList.push({ ip, reason: reason || "", addedAt: new Date().toISOString() });
  res.json({ ok: true, blocks: ipBlockList });
});

adminRouter.delete("/ip-blocks/:ip", (req, res) => {
  const ip = decodeURIComponent(req.params.ip);
  const idx = ipBlockList.findIndex(b => b.ip === ip);
  if (idx === -1) return res.status(404).json({ error: "IP not found" });
  ipBlockList.splice(idx, 1);
  res.json({ ok: true, blocks: ipBlockList });
});

// ===========================================================================
// 4. REPORTS — suspicious users
// ===========================================================================
adminRouter.get("/reports/suspicious", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { balance: { gt: 0 } },
      select: {
        id: true,
        username: true,
        balance: true,
        _count: { select: { bets: true } },
      },
      orderBy: { balance: "desc" },
      take: 50,
    });
    const result = users
      .filter((u) => u._count.bets > 0)
      .map((u) => ({ id: u.id, username: u.username, balance: u.balance, betCount: u._count.bets }));
    res.json({ users: result });
  } catch (err) {
    console.error("GET /admin/reports/suspicious error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 5. ANALYTICS
// ===========================================================================
adminRouter.get("/analytics", async (_req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentUsers, bets] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bet.findMany({
        select: { game: true, amount: true, payout: true },
      }),
    ]);

    // Daily signups: last 7 days
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    for (const u of recentUsers) {
      const key = new Date(u.createdAt).toISOString().slice(0, 10);
      if (key in dailyMap) dailyMap[key]++;
    }
    const dailySignups = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Bets per game
    const gameMap: Record<string, { count: number; wagered: number; paidOut: number }> = {};
    for (const bet of bets) {
      const g = bet.game || "unknown";
      if (!gameMap[g]) gameMap[g] = { count: 0, wagered: 0, paidOut: 0 };
      gameMap[g].count++;
      gameMap[g].wagered += bet.amount;
      gameMap[g].paidOut += bet.payout ?? 0;
    }
    const betsPerGame = Object.entries(gameMap)
      .map(([game, stats]) => ({ game, ...stats }))
      .sort((a, b) => b.count - a.count);

    // Win/loss ratio
    const totalBets = bets.length;
    const wins = bets.filter(b => (b.payout ?? 0) > b.amount).length;
    const winLossRatio = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : "0.0";

    res.json({ dailySignups, betsPerGame, winLossRatio, totalBets });
  } catch (err) {
    console.error("GET /admin/analytics error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 6. REFERRALS
// ===========================================================================
adminRouter.get("/referrals", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { username: "asc" },
      take: 100,
    });
    const referrals = users.map(u => ({
      id: u.id,
      username: u.username,
      referralCode: u.username.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.abs(u.id.charCodeAt(0) ^ u.id.charCodeAt(u.id.length - 1)),
      referredCount: 0,
      bonusEarned: 0,
    }));
    res.json({ referrals });
  } catch (err) {
    console.error("GET /admin/referrals error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 7. LEADERBOARD
// ===========================================================================
adminRouter.get("/leaderboard", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, xp: true, level: true, balance: true, _count: { select: { bets: true } } },
      orderBy: { xp: "desc" },
      take: 20,
    });
    res.json({ users: users.map((u) => ({ ...u, betCount: u._count.bets })) });
  } catch (err) {
    console.error("GET /admin/leaderboard error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

adminRouter.post("/leaderboard/reset", async (_req, res) => {
  try {
    await prisma.user.updateMany({ data: { xp: 0 } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /admin/leaderboard/reset error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 8. CHAT MODERATION
// ===========================================================================
const chatMutedUsers = new Set<string>();

adminRouter.get("/chat/messages", (_req, res) => {
  res.json({ messages: [], mutedUsers: Array.from(chatMutedUsers) });
});

adminRouter.post("/chat/mute", (req, res) => {
  const { username } = req.body as { username?: string };
  if (!username) return res.status(400).json({ error: "Username required" });
  chatMutedUsers.add(username.toLowerCase());
  res.json({ ok: true, mutedUsers: Array.from(chatMutedUsers) });
});

adminRouter.post("/chat/unmute", (req, res) => {
  const { username } = req.body as { username?: string };
  if (!username) return res.status(400).json({ error: "Username required" });
  chatMutedUsers.delete(username.toLowerCase());
  res.json({ ok: true, mutedUsers: Array.from(chatMutedUsers) });
});

// ===========================================================================
// 9. SCRATCH TICKET STATS
// ===========================================================================
adminRouter.get("/scratch/stats", async (_req, res) => {
  try {
    const agg = await prisma.bet.aggregate({
      where: { game: "scratch" },
      _count: { id: true },
      _sum: { amount: true, payout: true },
    });
    const totalSold = agg._count.id ?? 0;
    const totalWagered = agg._sum.amount ?? 0;
    const totalPaidOut = agg._sum.payout ?? 0;
    const revenue = totalWagered - totalPaidOut;
    res.json({ totalSold, totalWagered, totalPaidOut, revenue });
  } catch (err) {
    console.error("GET /admin/scratch/stats error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 10. PRIZE DRAWS
// ===========================================================================
interface Prize {
  id: string;
  name: string;
  chipAmount: number;
  createdAt: string;
  winner: { id: string; username: string } | null;
  drawnAt: string | null;
}
const prizeList: Prize[] = [];
let prizeCounter = 1;

adminRouter.get("/prizes", (_req, res) => {
  res.json({ prizes: prizeList });
});

adminRouter.post("/prizes/create", (req, res) => {
  const { name, chipAmount } = req.body as { name?: string; chipAmount?: number };
  if (!name) return res.status(400).json({ error: "Name required" });
  const prize: Prize = {
    id: String(prizeCounter++),
    name,
    chipAmount: Number(chipAmount) || 0,
    createdAt: new Date().toISOString(),
    winner: null,
    drawnAt: null,
  };
  prizeList.push(prize);
  res.json({ ok: true, prize });
});

adminRouter.post("/prizes/:id/draw", async (req, res) => {
  const prize = prizeList.find(p => p.id === req.params.id);
  if (!prize) return res.status(404).json({ error: "Prize not found" });
  if (prize.winner) return res.status(409).json({ error: "Winner already drawn" });

  try {
    const totalUsers = await prisma.user.count({ where: { isBanned: false } });
    if (totalUsers === 0) return res.status(400).json({ error: "No eligible users" });

    const skip = Math.floor(Math.random() * totalUsers);
    const [winner] = await prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true, username: true },
      skip,
      take: 1,
    });

    if (!winner) return res.status(400).json({ error: "No eligible users" });

    // Award chips
    if (prize.chipAmount > 0) {
      await prisma.user.update({
        where: { id: winner.id },
        data: { balance: { increment: prize.chipAmount * 100 } },
      });
    }

    prize.winner = { id: winner.id, username: winner.username };
    prize.drawnAt = new Date().toISOString();

    res.json({ ok: true, prize });
  } catch (err) {
    console.error("POST /admin/prizes/:id/draw error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ===========================================================================
// 11. PATREON SUBSCRIPTION MANAGEMENT
// ===========================================================================

// GET /admin/subscriptions/pending — users awaiting approval
adminRouter.get("/subscriptions/pending", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isApproved: false },
      select: { id: true, username: true, email: true, patreonUsername: true, patreonTier: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /admin/subscriptions — all subscription statuses
adminRouter.get("/subscriptions", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true, patreonUsername: true, patreonTier: true, isApproved: true, approvedUntil: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

const approveSchema = z.object({
  patreonTier: z.enum(["bronze_patron","silver_patron","gold_patron","platinum_patron","diamond_patron","netherite_patron"]).optional(),
  daysValid: z.number().int().min(1).max(365).optional(),
});

// POST /admin/subscriptions/:userId/approve — approve a user's subscription
adminRouter.post("/subscriptions/:userId/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { userId } = req.params;
  const { patreonTier = "bronze_patron", daysValid = 31 } = parsed.data;

  try {
    const approvedUntil = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true, approvedUntil, patreonTier },
      select: { id: true, username: true, isApproved: true, approvedUntil: true, patreonTier: true },
    });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve user" });
  }
});

// POST /admin/subscriptions/:userId/revoke — revoke a user's subscription
adminRouter.post("/subscriptions/:userId/revoke", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: false, approvedUntil: null, patreonTier: null },
      select: { id: true, username: true, isApproved: true },
    });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: "Failed to revoke subscription" });
  }
});

// POST /admin/subscriptions/revoke-expired — revoke all expired subscriptions
adminRouter.post("/subscriptions/revoke-expired", async (_req, res) => {
  try {
    const result = await prisma.user.updateMany({
      where: { isApproved: true, approvedUntil: { lt: new Date() } },
      data: { isApproved: false, patreonTier: null },
    });
    res.json({ ok: true, revoked: result.count });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /admin/users/:userId/admin — toggle isAdmin flag
adminRouter.patch("/users/:userId/admin", async (req, res) => {
  const { userId } = req.params;
  const { isAdmin } = req.body as { isAdmin?: boolean };
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (isOwner(user.username)) return res.status(400).json({ error: "Cannot change owner admin status" });
    const updated = await prisma.user.update({ where: { id: userId }, data: { isAdmin: isAdmin ?? !user.isAdmin } });
    res.json({ isAdmin: updated.isAdmin });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});
