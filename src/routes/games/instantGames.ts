import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { placeBet, BadBetInputError } from "../../lib/betting";
import { playDice, validateDice } from "../../games/dice";
import { playLimbo, validateLimbo } from "../../games/limbo";
import { dropBall, validatePlinko, PlinkoRisk, PlinkoRows } from "../../games/plinko";
import { playKeno, validateKeno } from "../../games/keno";
import { spinWheel, validateWheel, WheelRisk } from "../../games/wheel";
import { playBaccarat, validateBaccarat, BaccaratBet } from "../../games/baccarat";
import { InsufficientFundsError } from "../../lib/wallet";

export const instantGamesRouter = Router();

/** Shared error translation so every instant-game route reports the same shape for the same failures. */
function handleBetError(err: unknown, res: import("express").Response) {
  if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
  if (err instanceof BadBetInputError) return res.status(400).json({ error: err.message });
  console.error("Unexpected game error:", err);
  res.status(500).json({ error: "Something went wrong — please try again" });
}

// ---------------------------------------------------------------------------
// Dice — pick over/under a target 0-100, instant resolution.
// ---------------------------------------------------------------------------
const diceSchema = z.object({
  amount: z.number().int().positive(),
  target: z.number().min(0.01).max(99.99),
  direction: z.enum(["over", "under"]),
});

instantGamesRouter.post("/dice", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = diceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, target, direction } = parsed.data;
  const validation = validateDice({ target, direction });
  if (validation) return res.status(400).json({ error: validation });

  try {
    const placed = await placeBet(req.userId!, "dice", amount, (seeds) => {
      const outcome = playDice(seeds.serverSeed, seeds.clientSeed, seeds.nonce, { target, direction });
      return {
        payout: outcome.win ? Math.floor(amount * outcome.multiplier) : 0,
        multiplier: outcome.multiplier,
        result: outcome.win ? "win" : "loss",
        state: { target, direction, roll: outcome.roll, winChance: outcome.winChance },
      };
    });
    res.json(responsePayload(placed));
  } catch (err) {
    handleBetError(err, res);
  }
});

// ---------------------------------------------------------------------------
// Limbo — pick a target multiplier, win if the rolled multiplier clears it.
// ---------------------------------------------------------------------------
const limboSchema = z.object({
  amount: z.number().int().positive(),
  targetMultiplier: z.number().min(1.01).max(1_000_000),
});

instantGamesRouter.post("/limbo", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = limboSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, targetMultiplier } = parsed.data;
  const validation = validateLimbo({ targetMultiplier });
  if (validation) return res.status(400).json({ error: validation });

  try {
    const placed = await placeBet(req.userId!, "limbo", amount, (seeds) => {
      const outcome = playLimbo(seeds.serverSeed, seeds.clientSeed, seeds.nonce, { targetMultiplier });
      return {
        payout: outcome.win ? Math.floor(amount * outcome.multiplier) : 0,
        multiplier: outcome.multiplier,
        result: outcome.win ? "win" : "loss",
        state: { targetMultiplier, crashAt: outcome.crashAt },
      };
    });
    res.json(responsePayload(placed));
  } catch (err) {
    handleBetError(err, res);
  }
});

// ---------------------------------------------------------------------------
// Plinko — drop a ball through a peg board, land in a multiplier slot.
// ---------------------------------------------------------------------------
const plinkoSchema = z.object({
  amount: z.number().int().positive(),
  risk: z.enum(["low", "medium", "high"]),
  rows: z.number().int(),
});

instantGamesRouter.post("/plinko", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = plinkoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, risk, rows } = parsed.data;
  const validation = validatePlinko(risk, rows);
  if (validation) return res.status(400).json({ error: validation });

  try {
    const placed = await placeBet(req.userId!, "plinko", amount, (seeds) => {
      const outcome = dropBall(seeds.serverSeed, seeds.clientSeed, seeds.nonce, risk as PlinkoRisk, rows as PlinkoRows);
      const payout = Math.floor(amount * outcome.multiplier);
      return {
        payout,
        multiplier: outcome.multiplier,
        result: payout > amount ? "win" : "loss",
        state: { risk, rows, path: outcome.path, slot: outcome.slot },
      };
    });
    res.json(responsePayload(placed));
  } catch (err) {
    handleBetError(err, res);
  }
});

// ---------------------------------------------------------------------------
// Keno — pick 2-10 numbers from 1-80, house draws 20.
// ---------------------------------------------------------------------------
const kenoSchema = z.object({
  amount: z.number().int().positive(),
  picks: z.array(z.number().int()).min(2).max(10),
});

instantGamesRouter.post("/keno", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = kenoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, picks } = parsed.data;
  const validation = validateKeno(picks);
  if (validation) return res.status(400).json({ error: validation });

  try {
    const placed = await placeBet(req.userId!, "keno", amount, (seeds) => {
      const outcome = playKeno(seeds.serverSeed, seeds.clientSeed, seeds.nonce, picks);
      const payout = Math.floor(amount * outcome.multiplier);
      return {
        payout,
        multiplier: outcome.multiplier,
        result: payout > 0 ? "win" : "loss",
        state: {
          picks: outcome.picks,
          drawn: outcome.drawn,
          hits: outcome.hits,
          hitCount: outcome.hitCount,
          multiplier: outcome.multiplier,
        },
      };
    });
    res.json(responsePayload(placed));
  } catch (err) {
    handleBetError(err, res);
  }
});

// ---------------------------------------------------------------------------
// Wheel of Fortune — spin a weighted segment wheel.
// ---------------------------------------------------------------------------
const wheelSchema = z.object({
  amount: z.number().int().positive(),
  risk: z.enum(["low", "medium", "high"]),
});

instantGamesRouter.post("/wheel", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = wheelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, risk } = parsed.data;
  const validation = validateWheel(risk);
  if (validation) return res.status(400).json({ error: validation });

  try {
    const placed = await placeBet(req.userId!, "wheel", amount, (seeds) => {
      const outcome = spinWheel(seeds.serverSeed, seeds.clientSeed, seeds.nonce, risk as WheelRisk);
      const payout = Math.floor(amount * outcome.multiplier);
      return {
        payout,
        multiplier: outcome.multiplier,
        result: payout > 0 ? "win" : "loss",
        state: {
          risk: outcome.risk,
          segments: outcome.segments,
          landedIndex: outcome.landedIndex,
          multiplier: outcome.multiplier,
        },
      };
    });
    res.json(responsePayload(placed));
  } catch (err) {
    handleBetError(err, res);
  }
});

// ---------------------------------------------------------------------------
// Baccarat — player/banker/tie bet with standard baccarat card rules.
// ---------------------------------------------------------------------------
const baccaratSchema = z.object({
  amount: z.number().int().positive(),
  bet: z.enum(["player", "banker", "tie"]),
});

instantGamesRouter.post("/baccarat", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = baccaratSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { amount, bet } = parsed.data;
  const validation = validateBaccarat(bet);
  if (validation) return res.status(400).json({ error: validation });

  try {
    const placed = await placeBet(req.userId!, "baccarat", amount, (seeds) => {
      const outcome = playBaccarat(seeds.serverSeed, seeds.clientSeed, seeds.nonce, bet as BaccaratBet);
      const payout = Math.floor(amount * outcome.multiplier);
      return {
        payout,
        multiplier: outcome.multiplier,
        result: payout > 0 ? "win" : "loss",
        state: {
          bet: outcome.bet,
          playerCards: outcome.playerCards,
          bankerCards: outcome.bankerCards,
          playerTotal: outcome.playerTotal,
          bankerTotal: outcome.bankerTotal,
          winner: outcome.winner,
        },
      };
    });
    res.json(responsePayload(placed));
  } catch (err) {
    handleBetError(err, res);
  }
});

function responsePayload(placed: Awaited<ReturnType<typeof placeBet>>) {
  return {
    bet: placed.bet,
    balance: placed.balance,
    level: placed.level,
    xp: placed.xp,
    leveledUp: placed.leveledUp,
    nextNonce: placed.nonce + 1,
    result: placed.resolution,
  };
}
