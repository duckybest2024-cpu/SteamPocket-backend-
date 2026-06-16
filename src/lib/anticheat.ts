import { PrismaClient } from "@prisma/client";

// Called after every winning bet. Checks suspicious patterns and creates AnticheatEvent + flags user.
// Silent on normal activity — only acts when thresholds are crossed.
export async function checkForSuspiciousActivity(
  prisma: PrismaClient,
  userId: string,
  currentBet: { game: string; amount: number; payout: number; multiplier: number }
): Promise<void> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Run all data-fetch checks in parallel
    const [recentBets, bets24h] = await Promise.all([
      // Fetch enough recent bets to detect 15 consecutive wins
      prisma.bet.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { result: true, amount: true, payout: true },
      }),
      // Fetch all bets in last 24h for win rate and profit checks
      prisma.bet.findMany({
        where: {
          userId,
          createdAt: { gte: twentyFourHoursAgo },
        },
        select: { result: true, amount: true, payout: true },
      }),
    ]);

    const triggeredReasons: Array<{ reason: string; details: Record<string, unknown> }> = [];

    // ── Check 1: Consecutive wins ────────────────────────────────────────────
    let consecutiveWins = 0;
    for (const bet of recentBets) {
      if (bet.result === "win") {
        consecutiveWins++;
      } else {
        break;
      }
    }
    if (consecutiveWins >= 15) {
      triggeredReasons.push({
        reason: "CONSECUTIVE_WINS_15",
        details: { consecutiveWins },
      });
    }

    // ── Check 2: 24h win rate ────────────────────────────────────────────────
    const totalBets24h = bets24h.length;
    if (totalBets24h >= 30) {
      const wins24h = bets24h.filter((b) => b.result === "win").length;
      const winRate24h = wins24h / totalBets24h;
      if (winRate24h > 0.8) {
        triggeredReasons.push({
          reason: "HIGH_WIN_RATE_24H",
          details: {
            totalBets: totalBets24h,
            wins: wins24h,
            winRate: Math.round(winRate24h * 10000) / 10000,
          },
        });
      }
    }

    // ── Check 3: 24h net profit ──────────────────────────────────────────────
    const netProfit24h = bets24h.reduce((sum, b) => sum + (b.payout - b.amount), 0);
    const profitThreshold = 50000 * 100; // 50,000 chips expressed in cents
    if (netProfit24h > profitThreshold) {
      triggeredReasons.push({
        reason: "HIGH_PROFIT_24H",
        details: {
          netProfit: netProfit24h,
          threshold: profitThreshold,
          betsAnalyzed: bets24h.length,
        },
      });
    }

    // ── Check 4: Extreme multiplier ──────────────────────────────────────────
    if (currentBet.multiplier > 500) {
      triggeredReasons.push({
        reason: "EXTREME_MULTIPLIER",
        details: {
          multiplier: currentBet.multiplier,
          game: currentBet.game,
          amount: currentBet.amount,
          payout: currentBet.payout,
        },
      });
    }

    if (triggeredReasons.length === 0) return;

    // ── Fetch existing unresolved events for deduplication ───────────────────
    const existingEvents = await prisma.anticheatEvent.findMany({
      where: {
        userId,
        resolved: false,
        reason: { in: triggeredReasons.map((r) => r.reason) },
      },
      select: { reason: true },
    });
    const existingReasons = new Set(existingEvents.map((e) => e.reason));

    // Filter out already-flagged reasons
    const newReasons = triggeredReasons.filter((r) => !existingReasons.has(r.reason));
    if (newReasons.length === 0) return;

    // ── Create AnticheatEvents and flag the user ─────────────────────────────
    await Promise.all([
      // Create one AnticheatEvent per new triggered reason
      ...newReasons.map((r) =>
        prisma.anticheatEvent.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            reason: r.reason,
            details: JSON.stringify(r.details),
          },
        })
      ),
      // Flag the user using the first new reason (only if not already flagged)
      prisma.user.updateMany({
        where: { id: userId, flagged: false },
        data: {
          flagged: true,
          flagReason: newReasons[0].reason,
          flaggedAt: now,
        },
      }),
    ]);
  } catch (err) {
    // Anticheat errors must never crash the main request flow
    console.error("[anticheat] checkForSuspiciousActivity error:", err);
  }
}
