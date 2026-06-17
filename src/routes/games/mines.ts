import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { applyLedgerEntry, InsufficientFundsError, levelFromXp, xpForWager } from "../../lib/wallet";
import { minesRounds, MinesActiveRound } from "../../lib/activeRounds";
import { hashServerSeed } from "../../lib/provablyFair";
import {
  GRID_SIZE,
  layMines,
  multiplierForPicks,
  validateMineCount,
  validateTile,
} from "../../games/mines";

export const minesRouter = Router();

const startSchema = z.object({
  amount: z.number().int().positive(),
  mineCount: z.number().int(),
});

minesRouter.post("/start", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const userId = req.userId!;
  if (minesRounds.has(userId)) return res.status(409).json({ error: "You already have an active mines round — cash out or bust first" });

  const { amount, mineCount } = parsed.data;
  const mineCountError = validateMineCount(mineCount);
  if (mineCountError) return res.status(400).json({ error: mineCountError });

  try {
    // Escrow the wager and "spend" the current seed/nonce pair atomically — the mine layout is
    // fully determined right now, so reusing this nonce for anything else would leak information.
    const round = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await applyLedgerEntry(tx, userId, "bet", -amount, undefined);
      await tx.user.update({ where: { id: userId }, data: { nonce: { increment: 1 } } });

      const mines = layMines(user.serverSeed, user.clientSeed, user.nonce, mineCount);

      const active: MinesActiveRound = {
        betId: crypto.randomUUID(),
        amount,
        mineCount,
        mines,
        revealed: [],
        serverSeed: user.serverSeed,
        clientSeed: user.clientSeed,
        nonce: user.nonce,
        startedAt: Date.now(),
      };
      return active;
    });

    minesRounds.set(userId, round);
    const balance = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance;

    res.status(201).json({
      balance,
      round: publicRound(round),
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    throw err;
  }
});

const tileSchema = z.object({ tile: z.number().int() });

minesRouter.post("/reveal", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const round = minesRounds.get(userId);
  if (!round) return res.status(404).json({ error: "No active mines round — start one first" });

  const parsed = tileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { tile } = parsed.data;
  const tileError = validateTile(tile);
  if (tileError) return res.status(400).json({ error: tileError });
  if (round.revealed.includes(tile)) return res.status(400).json({ error: "Tile already revealed" });

  const hitMine = round.mines.includes(tile);

  if (hitMine) {
    minesRounds.clear(userId);
    const settled = await settleMines(userId, round, { cashedOut: false });
    return res.json({
      outcome: "bust",
      tile,
      ...settled,
      round: revealedRound(round),
    });
  }

  round.revealed.push(tile);
  const multiplier = multiplierForPicks(round.mineCount, round.revealed.length);
  const allSafeTilesFound = round.revealed.length === GRID_SIZE - round.mineCount;

  // Auto-cashout when every safe tile has been found — nothing left to gain by continuing.
  if (allSafeTilesFound) {
    minesRounds.clear(userId);
    const settled = await settleMines(userId, round, { cashedOut: true, multiplier });
    return res.json({
      outcome: "cleared",
      tile,
      multiplier,
      ...settled,
      round: revealedRound(round),
    });
  }

  res.json({
    outcome: "safe",
    tile,
    multiplier,
    nextMultiplier: multiplierForPicks(round.mineCount, round.revealed.length + 1),
    round: publicRound(round),
  });
});

minesRouter.post("/cashout", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const round = minesRounds.get(userId);
  if (!round) return res.status(404).json({ error: "No active mines round" });
  if (round.revealed.length === 0) return res.status(400).json({ error: "Reveal at least one tile before cashing out" });

  minesRounds.clear(userId);
  const multiplier = multiplierForPicks(round.mineCount, round.revealed.length);
  const settled = await settleMines(userId, round, { cashedOut: true, multiplier });

  res.json({
    outcome: "cashed_out",
    multiplier,
    ...settled,
    round: revealedRound(round),
  });
});

minesRouter.get("/active", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const round = minesRounds.get(req.userId!);
  if (!round) return res.status(404).json({ error: "No active round" });
  res.json({ round: publicRound(round) });
});

// ---------------------------------------------------------------------------

async function settleMines(
  userId: string,
  round: MinesActiveRound,
  outcome: { cashedOut: boolean; multiplier?: number }
) {
  const payout = outcome.cashedOut ? Math.floor(round.amount * (outcome.multiplier ?? 1)) : 0;
  const multiplier = outcome.cashedOut ? outcome.multiplier ?? 1 : 0;

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (payout > 0) {
      user = await applyLedgerEntry(tx, userId, "payout", payout, undefined);
    }

    const gainedXp = xpForWager(round.amount);
    const newXp = user.xp + gainedXp;
    const newLevel = levelFromXp(newXp);
    const leveledUp = newLevel > user.level;
    const levelBonus = leveledUp ? newLevel * 500 : 0;

    user = await tx.user.update({
      where: { id: userId },
      data: { xp: newXp, level: newLevel, ...(levelBonus > 0 ? { balance: { increment: levelBonus } } : {}) },
    });

    if (levelBonus > 0) {
      await tx.transaction.create({
        data: { userId, type: "levelup_bonus", amount: levelBonus, balance: user.balance, reference: `level_${newLevel}` },
      });
    }

    const bet = await tx.bet.create({
      data: {
        userId,
        game: "mines",
        amount: round.amount,
        payout,
        multiplier,
        result: payout > 0 ? "win" : "loss",
        state: JSON.stringify({
          mineCount: round.mineCount,
          mines: round.mines,
          revealed: round.revealed,
          cashedOut: outcome.cashedOut,
        }),
        clientSeed: round.clientSeed,
        serverSeed: round.serverSeed,
        nonce: round.nonce,
      },
    });

    return {
      betId: bet.id,
      payout,
      balance: user.balance,
      level: user.level,
      xp: user.xp,
      leveledUp,
    };
  });
}

/** Round view while still in progress — mine locations stay hidden. */
function publicRound(round: MinesActiveRound) {
  return {
    amount: round.amount,
    mineCount: round.mineCount,
    revealed: round.revealed,
    currentMultiplier: multiplierForPicks(round.mineCount, round.revealed.length),
    nextMultiplier: multiplierForPicks(round.mineCount, round.revealed.length + 1),
    serverSeedHash: hashServerSeed(round.serverSeed),
    clientSeed: round.clientSeed,
    nonce: round.nonce,
  };
}

/** Round view after settlement — full mine layout revealed for verification. */
function revealedRound(round: MinesActiveRound) {
  return { ...publicRound(round), mines: round.mines };
}
