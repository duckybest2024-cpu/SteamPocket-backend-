import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { isOwner } from "../lib/owner";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (req, res) => {
  const type = (req.query.type as string) || "money";

  try {
    let leaderboard: any[];

    if (type === "wins" || type === "losses") {
      const result = type === "wins" ? "win" : "loss";
      const grouped = await prisma.bet.groupBy({
        by: ["userId"],
        where: { result },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 100,
      });

      const userIds = grouped.map((g) => g.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, isBanned: false },
        select: { id: true, username: true, nickname: true, rank: true, level: true },
      });

      const userMap = new Map<string, any>(users.map((u) => [u.id, u]));
      leaderboard = grouped
        .filter((g) => userMap.has(g.userId))
        .map((g, i) => {
          const u = userMap.get(g.userId)!;
          return {
            rank: i + 1,
            username: u.username,
            nickname: u.nickname,
            displayName: u.nickname || u.username,
            userRank: isOwner(u.username) ? "owner" : u.rank,
            level: u.level,
            [type]: g._count.id,
          };
        });
    } else if (type === "overall") {
      const [users, winGroups] = await Promise.all([
        prisma.user.findMany({
          where: { isBanned: false },
          include: { _count: { select: { bets: true } } },
          take: 500,
        }),
        prisma.bet.groupBy({
          by: ["userId"],
          where: { result: "win" },
          _count: { id: true },
        }),
      ]);

      const winMap = new Map<string, number>(winGroups.map((g) => [g.userId, g._count.id]));

      const scored = users
        .map((u) => {
          const wins = winMap.get(u.id) ?? 0;
          const wealthChips = Math.floor((u.balance + u.bank) / 100);
          const score = wealthChips + wins * 50 + u.level * 200;
          return {
            username: u.username,
            nickname: u.nickname,
            displayName: u.nickname || u.username,
            userRank: isOwner(u.username) ? "owner" : u.rank,
            level: u.level,
            betCount: u._count.bets,
            totalChips: u.balance + u.bank,
            wins,
            score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((u, i) => ({ rank: i + 1, ...u }));

      leaderboard = scored;
    } else {
      const users = await prisma.user.findMany({
        where: { isBanned: false },
        include: { _count: { select: { bets: true } } },
        take: 500,
      });

      const sorted = users
        .map((u) => ({
          username: u.username,
          nickname: u.nickname,
          displayName: u.nickname || u.username,
          userRank: isOwner(u.username) ? "owner" : u.rank,
          level: u.level,
          betCount: u._count.bets,
          balance: u.balance,
          bank: u.bank,
          totalChips: u.balance + u.bank,
        }))
        .sort((a, b) => (type === "chips" ? b.balance - a.balance : b.totalChips - a.totalChips))
        .slice(0, 50)
        .map((u, i) => ({ rank: i + 1, ...u }));

      leaderboard = sorted;
    }

    res.json({ leaderboard, type });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

leaderboardRouter.get("/me", requireAuth as any, async (req: AuthedRequest, res) => {
  const type = (req.query.type as string) || "money";

  try {
    if (type === "wins" || type === "losses") {
      const result = type === "wins" ? "win" : "loss";
      const count = await prisma.bet.count({ where: { userId: req.userId!, result } });
      const allGrouped = await prisma.bet.groupBy({
        by: ["userId"],
        where: { result },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });
      const idx = allGrouped.findIndex((g) => g.userId === req.userId);
      res.json({ rank: idx === -1 ? null : idx + 1, [type]: count });
    } else if (type === "overall") {
      const [allUsers, winGroups] = await Promise.all([
        prisma.user.findMany({ where: { isBanned: false }, select: { id: true, balance: true, bank: true, level: true } }),
        prisma.bet.groupBy({ by: ["userId"], where: { result: "win" }, _count: { id: true } }),
      ]);
      const winMap = new Map<string, number>(winGroups.map((g) => [g.userId, g._count.id]));
      const scored = allUsers
        .map((u) => ({
          id: u.id,
          score: Math.floor((u.balance + u.bank) / 100) + (winMap.get(u.id) ?? 0) * 50 + u.level * 200,
        }))
        .sort((a, b) => b.score - a.score);
      const idx = scored.findIndex((u) => u.id === req.userId);
      res.json({ rank: idx === -1 ? null : idx + 1 });
    } else {
      const allUsers = await prisma.user.findMany({
        where: { isBanned: false },
        select: { id: true, balance: true, bank: true },
      });
      const sorted = allUsers
        .map((u) => ({ id: u.id, val: type === "chips" ? u.balance : u.balance + u.bank }))
        .sort((a, b) => b.val - a.val);
      const idx = sorted.findIndex((u) => u.id === req.userId);
      res.json({ rank: idx === -1 ? null : idx + 1 });
    }
  } catch (err) {
    console.error("Leaderboard/me error:", err);
    res.status(500).json({ error: "Failed to load rank" });
  }
});
