import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { isOwner } from "../lib/owner";

/**
 * The "Netherite Lounge" — a cosmetic, read-only VIP panel for top-tier
 * (Netherite Patron) subscribers. It deliberately contains nothing sensitive:
 * no balance editing, no odds, no user management, no config. Just the
 * subscriber's own stats, their perks, and a top-players board. Real admin
 * powers stay owner-only (see admin.ts).
 */
export const vipRouter = Router();

const PERKS = [
  "💎 Netherite badge next to your name",
  "🏆 Exclusive access to the Netherite Lounge",
  "📈 Personal lifetime stats dashboard",
  "🎟️ Priority entry to special events & giveaways",
  "💸 Eligible for discretionary cash prize rewards",
  "🎨 VIP profile flair",
];

// Gate: Netherite Patron tier (or the owner, who can preview it).
const vipOnly = [
  requireAuth,
  async (req: AuthedRequest, res: import("express").Response, next: import("express").NextFunction) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { username: true, patreonTier: true },
    });
    if (!user || (user.patreonTier !== "netherite_patron" && !isOwner(user.username))) {
      return res.status(403).json({ error: "Netherite Patron only" });
    }
    next();
  },
];

vipRouter.get("/me", vipOnly, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        username: true, nickname: true, balance: true, bank: true, level: true,
        xp: true, rank: true, patreonTier: true, approvedUntil: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const [betCount, agg, biggest] = await Promise.all([
      prisma.bet.count({ where: { userId: req.userId! } }),
      prisma.bet.aggregate({ where: { userId: req.userId! }, _sum: { amount: true, payout: true } }),
      prisma.bet.findFirst({ where: { userId: req.userId! }, orderBy: { payout: "desc" }, select: { payout: true, game: true, multiplier: true } }),
    ]);

    // Top players board — by balance, names only (nothing sensitive).
    const top = await prisma.user.findMany({
      orderBy: { balance: "desc" },
      take: 10,
      select: { username: true, nickname: true, level: true, balance: true },
    });

    const daysLeft = user.approvedUntil
      ? Math.max(0, Math.ceil((user.approvedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

    res.json({
      tier: isOwner(user.username) ? "owner" : (user.patreonTier ?? null),
      daysLeft,
      memberSince: user.createdAt,
      perks: PERKS,
      stats: {
        balance: user.balance,
        bank: user.bank,
        level: user.level,
        xp: user.xp,
        rank: user.rank,
        totalBets: betCount,
        totalWagered: agg._sum.amount ?? 0,
        totalWon: agg._sum.payout ?? 0,
        biggestWin: biggest?.payout ?? 0,
        biggestWinGame: biggest?.game ?? null,
      },
      topPlayers: top.map((t, i) => ({
        place: i + 1,
        name: t.nickname || t.username,
        level: t.level,
        balance: t.balance,
      })),
    });
  } catch (err) {
    console.error("GET /vip/me error:", err);
    res.status(500).json({ error: "Failed to load VIP lounge" });
  }
});
