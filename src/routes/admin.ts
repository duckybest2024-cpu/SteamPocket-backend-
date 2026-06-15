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

adminRouter.use(adminOnly);

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
        id: u.id, username: u.username, email: u.email, balance: u.balance, bank: u.bank,
        level: u.level, xp: u.xp, isBanned: u.isBanned, createdAt: u.createdAt, betCount: u._count.bets,
      })),
      total, page, pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /admin/users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

adminRouter.post("/ban/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const updated = await prisma.user.update({ where: { id: userId }, data: { isBanned: !user.isBanned } });
    res.json({ isBanned: updated.isBanned });
  } catch (err) {
    console.error("POST /admin/ban/:userId error:", err);
    res.status(500).json({ error: "Failed to update ban status" });
  }
});

const adjustSchema = z.object({ amount: z.number().int(), note: z.string().min(1) });

adminRouter.post("/adjust-balance/:userId", async (req, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { amount, note } = parsed.data;
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data: { balance: { increment: amount } } });
      await tx.transaction.create({ data: { userId, type: "admin_adjustment", amount, balance: u.balance, reference: note } });
      return u;
    });
    res.json({ balance: updated.balance });
  } catch (err) {
    console.error("POST /admin/adjust-balance/:userId error:", err);
    res.status(500).json({ error: "Failed to adjust balance" });
  }
});

adminRouter.delete("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (isOwner(user.username)) return res.status(403).json({ error: "Cannot delete the admin account" });
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
    const transactions = await prisma.houseBankTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    res.json({ chips: bank.chips, dollars: bank.dollars, houseIncome, totalWagered, totalPaidOut, transactions });
  } catch (err) {
    console.error("GET /admin/bank error:", err);
    res.status(500).json({ error: "Failed to load bank" });
  }
});

const bankAdjustSchema = z.object({ type: z.enum(["chips", "dollars"]), amount: z.number().int(), note: z.string().min(1) });

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
    await prisma.houseBankTransaction.create({ data: { type: amount >= 0 ? `${type}_add` : `${type}_remove`, chipsChange: type === "chips" ? amount : 0, dollarsChange: type === "dollars" ? amount : 0, note } });
    res.json({ chips: bank.chips, dollars: bank.dollars });
  } catch (err) {
    console.error("POST /admin/bank/adjust error:", err);
    res.status(500).json({ error: "Failed to adjust bank" });
  }
});

const ownerOnly: RequestHandler[] = [
  requireAuth as RequestHandler,
  async (req: AuthedRequest, res, next) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !isOwner(user.username)) return res.status(403).json({ error: "Only the owner can change ranks" });
    next();
  },
];

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

adminRouter.get("/stats/games", async (_req, res) => {
  try {
    const grouped = await prisma.bet.groupBy({
      by: ["game"],
      _sum: { amount: true, payout: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
    });
    res.json({ games: grouped.map((g) => ({ game: g.game, wagered: g._sum.amount ?? 0, paidOut: g._sum.payout ?? 0, bets: g._count._all, edge: g._sum.amount ? (((g._sum.amount - (g._sum.payout ?? 0)) / g._sum.amount) * 100).toFixed(2) : "0.00" })) });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/stats/revenue", async (_req, res) => {
  try {
    const days = 14;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const bets = await prisma.bet.findMany({ where: { createdAt: { gte: since } }, select: { amount: true, payout: true, createdAt: true } });
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

adminRouter.get("/bets", async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const bets = await prisma.bet.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { user: { select: { username: true } } } });
    res.json({ bets });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/payments", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 50;
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where: { type: { in: ["deposit", "withdrawal", "promo"] } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { user: { select: { username: true } } } }),
      prisma.transaction.count({ where: { type: { in: ["deposit", "withdrawal", "promo"] } } }),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/top-players", async (_req, res) => {
  try {
    const grouped = await prisma.bet.groupBy({ by: ["userId"], _sum: { amount: true, payout: true }, _count: { _all: true }, orderBy: { _sum: { amount: "desc" } }, take: 20 });
    const userList = await prisma.user.findMany({ where: { id: { in: grouped.map((g) => g.userId) } }, select: { id: true, username: true, level: true } });
    const userMap = new Map(userList.map((u) => [u.id, u]));
    res.json({ players: grouped.map((g) => ({ username: userMap.get(g.userId)?.username ?? "unknown", level: userMap.get(g.userId)?.level ?? 1, wagered: g._sum.amount ?? 0, paidOut: g._sum.payout ?? 0, profit: (g._sum.payout ?? 0) - (g._sum.amount ?? 0), bets: g._count._all })) });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

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

adminRouter.get("/promos", async (_req, res) => {
  const promos = await prisma.promoCode.findMany({ include: { _count: { select: { redemptions: true } } }, orderBy: { createdAt: "desc" } });
  res.json({ promos });
});

adminRouter.post("/promos", async (req, res) => {
  const { code, chips, maxUses = 1, expiresAt } = req.body as { code?: string; chips?: number; maxUses?: number; expiresAt?: string };
  if (!code || !chips) return res.status(400).json({ error: "code and chips required" });
  try {
    const promo = await prisma.promoCode.create({ data: { code: code.toUpperCase().trim(), chips: Math.round(Number(chips) * 100), maxUses: Number(maxUses) || 1, expiresAt: expiresAt ? new Date(expiresAt) : undefined } });
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

adminRouter.get("/config", async (_req, res) => {
  const configs = await prisma.siteConfig.findMany();
  const obj: Record<string, string> = {};
  for (const c of configs) obj[c.key] = c.value;
  res.json(obj);
});

adminRouter.post("/config", async (req, res) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await prisma.siteConfig.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
  res.json({ ok: true });
});

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

adminRouter.get("/nfts", async (_req, res) => {
  try {
    const nfts = await prisma.nft.findMany({ orderBy: { mintedAt: "desc" }, take: 100, include: { owner: { select: { username: true } } } });
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

adminRouter.get("/flags", async (_req, res) => {
  try {
    const events = await (prisma as any).anticheatEvent.findMany({ where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 100 });
    const userIds = [...new Set(events.map((e: any) => e.userId))] as string[];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, balance: true, flagged: true, flagReason: true, flaggedAt: true, isBanned: true } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    res.json({ events: events.map((e: any) => ({ ...e, details: (() => { try { return JSON.parse(e.details); } catch { return {}; } })(), user: userMap.get(e.userId) ?? null })) });
  } catch (err) { console.error("GET /admin/flags error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/flags/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ where: { flagged: true }, select: { id: true, username: true, email: true, balance: true, flagged: true, flagReason: true, flaggedAt: true, isBanned: true, createdAt: true }, orderBy: { flaggedAt: "desc" } });
    res.json({ users });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.post("/flags/:eventId/resolve", async (req: AuthedRequest, res) => {
  const { resolution } = req.body as { resolution?: string };
  try {
    const event = await (prisma as any).anticheatEvent.update({ where: { id: req.params.eventId }, data: { resolved: true, resolvedAt: new Date(), resolvedBy: req.userId, resolution: resolution || "dismissed" } });
    const remaining = await (prisma as any).anticheatEvent.count({ where: { userId: event.userId, resolved: false } });
    if (remaining === 0) await prisma.user.update({ where: { id: event.userId }, data: { flagged: false, flagReason: null } });
    res.json({ ok: true, event });
  } catch (err) { console.error("POST /admin/flags/:eventId/resolve error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.post("/flags/user/:userId/clear", async (req: AuthedRequest, res) => {
  try {
    await (prisma as any).anticheatEvent.updateMany({ where: { userId: req.params.userId, resolved: false }, data: { resolved: true, resolvedAt: new Date(), resolvedBy: req.userId, resolution: "cleared_by_admin" } });
    await prisma.user.update({ where: { id: req.params.userId }, data: { flagged: false, flagReason: null, flaggedAt: null } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.post("/flags/user/:userId/ban", async (req: AuthedRequest, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.userId }, data: { isBanned: true, flagReason: "banned_by_admin" } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/maintenance", (_req, res) => { res.json({ enabled: false }); });

adminRouter.get("/reports/suspicious", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ where: { balance: { gt: 0 } }, select: { id: true, username: true, balance: true, _count: { select: { bets: true } } }, orderBy: { balance: "desc" }, take: 50 });
    res.json({ users: users.filter((u) => u._count.bets > 0).map((u) => ({ id: u.id, username: u.username, balance: u.balance, betCount: u._count.bets })) });
  } catch (err) { console.error("GET /admin/reports/suspicious error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/analytics", async (_req, res) => {
  try {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [recentUsers, bets] = await Promise.all([
      prisma.user.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
      prisma.bet.findMany({ select: { game: true, amount: true, payout: true } }),
    ]);
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dailyMap[d.toISOString().slice(0, 10)] = 0; }
    for (const u of recentUsers) { const key = new Date(u.createdAt).toISOString().slice(0, 10); if (key in dailyMap) dailyMap[key]++; }
    const dailySignups = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
    const gameMap: Record<string, { count: number; wagered: number; paidOut: number }> = {};
    for (const bet of bets) { const g = bet.game || "unknown"; if (!gameMap[g]) gameMap[g] = { count: 0, wagered: 0, paidOut: 0 }; gameMap[g].count++; gameMap[g].wagered += bet.amount; gameMap[g].paidOut += bet.payout ?? 0; }
    const betsPerGame = Object.entries(gameMap).map(([game, stats]) => ({ game, ...stats })).sort((a, b) => b.count - a.count);
    const totalBets = bets.length;
    const wins = bets.filter(b => (b.payout ?? 0) > b.amount).length;
    const winLossRatio = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : "0.0";
    res.json({ dailySignups, betsPerGame, winLossRatio, totalBets });
  } catch (err) { console.error("GET /admin/analytics error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/leaderboard", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, xp: true, level: true, balance: true, _count: { select: { bets: true } } }, orderBy: { xp: "desc" }, take: 20 });
    res.json({ users: users.map((u) => ({ ...u, betCount: u._count.bets })) });
  } catch (err) { console.error("GET /admin/leaderboard error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.post("/leaderboard/reset", async (_req, res) => {
  try { await prisma.user.updateMany({ data: { xp: 0 } }); res.json({ ok: true }); }
  catch (err) { console.error("POST /admin/leaderboard/reset error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/chat/messages", (_req, res) => { res.json({ messages: [], mutedUsers: [] }); });

adminRouter.get("/scratch/stats", async (_req, res) => {
  try {
    const agg = await prisma.bet.aggregate({ where: { game: "scratch" }, _count: { id: true }, _sum: { amount: true, payout: true } });
    res.json({ totalSold: agg._count.id ?? 0, totalWagered: agg._sum.amount ?? 0, totalPaidOut: agg._sum.payout ?? 0, revenue: (agg._sum.amount ?? 0) - (agg._sum.payout ?? 0) });
  } catch (err) { console.error("GET /admin/scratch/stats error:", err); res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/referrals", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true }, orderBy: { username: "asc" }, take: 100 });
    res.json({ referrals: users.map(u => ({ id: u.id, username: u.username, referralCode: u.username.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.abs(u.id.charCodeAt(0) ^ u.id.charCodeAt(u.id.length - 1)), referredCount: 0, bonusEarned: 0 })) });
  } catch (err) { console.error("GET /admin/referrals error:", err); res.status(500).json({ error: "Failed" }); }
});

// ===========================================================================
// PATREON SUBSCRIPTION MANAGEMENT
// ===========================================================================

adminRouter.get("/subscriptions/pending", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ where: { isApproved: false }, select: { id: true, username: true, email: true, patreonUsername: true, patreonTier: true, createdAt: true }, orderBy: { createdAt: "desc" } });
    res.json({ users });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.get("/subscriptions", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, patreonUsername: true, patreonTier: true, isApproved: true, approvedUntil: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ users });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

const approveSchema = z.object({
  patreonTier: z.enum(["bronze_patron","silver_patron","gold_patron","platinum_patron","diamond_patron","netherite_patron"]).optional(),
  daysValid: z.number().int().min(1).max(365).optional(),
});

adminRouter.post("/subscriptions/:userId/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { userId } = req.params;
  const { patreonTier = "bronze_patron", daysValid = 31 } = parsed.data;
  try {
    const approvedUntil = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
    const user = await prisma.user.update({ where: { id: userId }, data: { isApproved: true, approvedUntil, patreonTier }, select: { id: true, username: true, isApproved: true, approvedUntil: true, patreonTier: true } });
    res.json({ ok: true, user });
  } catch (err) { res.status(500).json({ error: "Failed to approve user" }); }
});

adminRouter.post("/subscriptions/:userId/revoke", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: { isApproved: false, approvedUntil: null, patreonTier: null }, select: { id: true, username: true, isApproved: true } });
    res.json({ ok: true, user });
  } catch (err) { res.status(500).json({ error: "Failed to revoke subscription" }); }
});

adminRouter.post("/subscriptions/revoke-expired", async (_req, res) => {
  try {
    const result = await prisma.user.updateMany({ where: { isApproved: true, approvedUntil: { lt: new Date() } }, data: { isApproved: false, patreonTier: null } });
    res.json({ ok: true, revoked: result.count });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

adminRouter.patch("/users/:userId/admin", async (req, res) => {
  const { userId } = req.params;
  const { isAdmin } = req.body as { isAdmin?: boolean };
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (isOwner(user.username)) return res.status(400).json({ error: "Cannot change owner admin status" });
    const updated = await prisma.user.update({ where: { id: userId }, data: { isAdmin: isAdmin ?? !user.isAdmin } });
    res.json({ isAdmin: updated.isAdmin });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});
