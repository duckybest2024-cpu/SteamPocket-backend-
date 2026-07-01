import { prisma } from "./prisma";
import { applyLedgerEntry, levelFromXp, xpForWager } from "./wallet";
import { checkForSuspiciousActivity } from "./anticheat";

export interface BetResolution {
  payout: number;
  multiplier: number;
  result: "win" | "loss";
  state: unknown; // serialised per-game round detail (dice roll, mine layout, card hands, ...)
}

export interface PlacedBet {
  bet: { id: string; createdAt: Date };
  balance: number;
  level: number;
  xp: number;
  leveledUp: boolean;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  resolution: BetResolution;
}

/**
 * Single choke-point for "spend money, run a provably-fair game, pay out the result."
 * Wrapped in one DB transaction so a crash mid-resolution can never leave a player
 * charged without a settled bet, or paid without having been charged.
 *
 * `resolve` receives the *current* seed pair + nonce (the one this wager will be settled
 * under) and must be a pure function of them — that's what makes the bet replayable later.
 */
export async function placeBet(
  userId: string,
  game: string,
  amount: number,
  resolve: (seeds: { serverSeed: string; clientSeed: string; nonce: number }) => BetResolution
): Promise<PlacedBet> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BadBetInputError("amount must be a positive integer (cents)");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const seeds = { serverSeed: user.serverSeed, clientSeed: user.clientSeed, nonce: user.nonce };

    // 1. Take the wager.
    await applyLedgerEntry(tx, userId, "bet", -amount, undefined);

    // 2. Resolve the round deterministically from the current seed triple.
    const resolution = resolve(seeds);

    // 3. Pay out (if anything was won), applying 5% rake on net profit.
    let afterPayout = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (resolution.payout > 0) {
      let creditAmount = resolution.payout;
      const netProfit = resolution.payout - amount;
      if (netProfit > 0) {
        // 5% rake on net winnings (house cut, not recorded separately)
        creditAmount = resolution.payout - Math.floor(netProfit * 0.05);
      }
      afterPayout = await applyLedgerEntry(tx, userId, "payout", creditAmount, undefined);
    }

    // 4. XP / leveling from wager volume (win or lose, the house always rewards action).
    const gainedXp = xpForWager(amount);
    const newXp = afterPayout.xp + gainedXp;
    const newLevel = levelFromXp(newXp);
    const leveledUp = newLevel > afterPayout.level;

    // Leveling is purely cosmetic — XP/level drive only a progress badge, they
    // grant no chips and have no effect on the game economy or odds.
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel,
        nonce: { increment: 1 },
      },
    });

    const bet = await tx.bet.create({
      data: {
        userId,
        game,
        amount,
        payout: resolution.payout,
        multiplier: resolution.multiplier,
        state: JSON.stringify(resolution.state),
        result: resolution.result,
        clientSeed: seeds.clientSeed,
        serverSeed: seeds.serverSeed,
        nonce: seeds.nonce,
      },
    });

    return {
      bet: { id: bet.id, createdAt: bet.createdAt },
      balance: updated.balance,
      level: updated.level,
      xp: updated.xp,
      leveledUp,
      serverSeed: seeds.serverSeed,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
      resolution,
    };
  }).then(async (result) => {
    // Fire-and-forget anti-cheat check on every win (never blocks the response)
    if (result.resolution.result === "win") {
      checkForSuspiciousActivity(prisma, userId, {
        game,
        amount,
        payout: result.resolution.payout,
        multiplier: result.resolution.multiplier,
      }).catch(() => {});
    }
    return result;
  });
}

export class BadBetInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadBetInputError";
  }
}
