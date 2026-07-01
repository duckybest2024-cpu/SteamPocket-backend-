import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const statsRouter = Router();

// GET /stats/me — authenticated user's own stats
statsRouter.get("/me", requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;

    const [user, bets] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, level: true, xp: true, balance: true, bank: true, createdAt: true, rank: true },
      }),
      prisma.bet.findMany({
        where: { userId },
        select: { game: true, amount: true, payout: true, result: true, multiplier: true, createdAt: true },
      }),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });

    const totalBets = bets.length;
    const wins = bets.filter((b) => b.result === "win").length;
    const losses = bets.filter((b) => b.result === "loss").length;
    const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
    const totalPayout = bets.reduce((s, b) => s + b.payout, 0);
    const netProfit = totalPayout - totalWagered;
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    // Best win by payout amount
    const bestWin = bets
      .filter((b) => b.result === "win")
      .sort((a, b) => b.payout - a.payout)[0] ?? null;

    // Biggest multiplier hit
    const biggestMultiplier = bets
      .filter((b) => b.result === "win")
      .sort((a, b) => b.multiplier - a.multiplier)[0] ?? null;

    // Favorite game (most bets)
    const gameCount: Record<string, number> = {};
    for (const b of bets) gameCount[b.game] = (gameCount[b.game] ?? 0) + 1;
    const favoriteGame = Object.entries(gameCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Stats per game
    const gameStats: Record<string, { bets: number; wins: number; wagered: number; payout: number }> = {};
    for (const b of bets) {
      if (!gameStats[b.game]) gameStats[b.game] = { bets: 0, wins: 0, wagered: 0, payout: 0 };
      gameStats[b.game].bets++;
      if (b.result === "win") gameStats[b.game].wins++;
      gameStats[b.game].wagered += b.amount;
      gameStats[b.game].payout += b.payout;
    }

    // Recent bets (last 20)
    const recentBets = await prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { game: true, amount: true, payout: true, result: true, multiplier: true, createdAt: true },
    });

    res.json({
      user: { ...user, balance: user.balance, bank: user.bank },
      stats: {
        totalBets,
        wins,
        losses,
        winRate: Math.round(winRate * 10) / 10,
        totalWagered,
        totalPayout,
        netProfit,
        favoriteGame,
        bestWin: bestWin ? { game: bestWin.game, payout: bestWin.payout, multiplier: bestWin.multiplier } : null,
        biggestMultiplier: biggestMultiplier
          ? { game: biggestMultiplier.game, multiplier: biggestMultiplier.multiplier, payout: biggestMultiplier.payout }
          : null,
        gameStats,
      },
      recentBets,
    });
  } catch (err) {
    console.error("Stats/me error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// GET /stats/player/:username — public profile
statsRouter.get("/player/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, nickname: true, level: true, rank: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "Player not found" });

    const bets = await prisma.bet.findMany({
      where: { userId: user.id },
      select: { game: true, amount: true, payout: true, result: true, multiplier: true },
    });

    const totalBets = bets.length;
    const wins = bets.filter((b) => b.result === "win").length;
    const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
    const totalPayout = bets.reduce((s, b) => s + b.payout, 0);
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    const gameCount: Record<string, number> = {};
    for (const b of bets) gameCount[b.game] = (gameCount[b.game] ?? 0) + 1;
    const favoriteGame = Object.entries(gameCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const bestWin = bets
      .filter((b) => b.result === "win")
      .sort((a, b) => b.multiplier - a.multiplier)[0] ?? null;

    res.json({
      user,
      stats: {
        totalBets,
        wins,
        losses: totalBets - wins,
        winRate: Math.round(winRate * 10) / 10,
        totalWagered,
        totalPayout,
        netProfit: totalPayout - totalWagered,
        favoriteGame,
        bestWin: bestWin ? { game: bestWin.game, multiplier: bestWin.multiplier } : null,
      },
    });
  } catch (err) {
    console.error("Stats/player error:", err);
    res.status(500).json({ error: "Failed to load player stats" });
  }
});
