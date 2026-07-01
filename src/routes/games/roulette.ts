import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { placeBet, BadBetInputError } from "../../lib/betting";
import { InsufficientFundsError } from "../../lib/wallet";
import {
  betWins,
  colorOf,
  expandGroup,
  payoutMultiplier,
  spinWheel,
  validateRouletteBet,
  RouletteBet,
  RouletteBetType,
} from "../../games/roulette";

export const rouletteRouter = Router();

const betSchema = z.object({
  type: z.enum(["straight", "split", "street", "corner", "line", "dozen", "column", "red", "black", "even", "odd", "low", "high"]),
  amount: z.number().int().positive(),
  numbers: z.array(z.number().int().min(0).max(36)).optional(),
  group: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

const spinSchema = z.object({
  bets: z.array(betSchema).min(1).max(40),
});

const MAX_TOTAL_STAKE = 5_000_000; // $50,000 — sanity ceiling on a single spin across all bets combined

rouletteRouter.post("/spin", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = spinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  // Build & validate fully-resolved bets (dozen/column groups expanded to their pocket numbers).
  const bets: RouletteBet[] = [];
  for (const raw of parsed.data.bets) {
    let numbers = raw.numbers ?? [];
    if ((raw.type === "dozen" || raw.type === "column") && raw.group) {
      numbers = expandGroup(raw.type, raw.group);
    }
    const bet: RouletteBet = { type: raw.type as RouletteBetType, amount: raw.amount, numbers };
    const error = validateRouletteBet(bet);
    if (error) return res.status(400).json({ error });
    bets.push(bet);
  }

  const totalStake = bets.reduce((sum, b) => sum + b.amount, 0);
  if (totalStake > MAX_TOTAL_STAKE) return res.status(400).json({ error: "Total stake across all bets exceeds the table limit" });

  try {
    const placed = await placeBet(req.userId!, "roulette", totalStake, (seeds) => {
      const landed = spinWheel(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
      const color = colorOf(landed);

      let totalPayout = 0;
      const breakdown = bets.map((bet) => {
        const won = betWins(bet, landed);
        const payout = won ? bet.amount * payoutMultiplier(bet.type) : 0;
        totalPayout += payout;
        return { type: bet.type, amount: bet.amount, numbers: bet.numbers, won, payout };
      });

      return {
        payout: totalPayout,
        multiplier: totalStake > 0 ? Number((totalPayout / totalStake).toFixed(4)) : 0,
        result: totalPayout > totalStake ? "win" : "loss",
        state: { landed, color, bets: breakdown },
      };
    });

    res.json({
      bet: placed.bet,
      balance: placed.balance,
      level: placed.level,
      xp: placed.xp,
      leveledUp: placed.leveledUp,
      result: placed.resolution,
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    if (err instanceof BadBetInputError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

/** Static reference data for building the betting board client-side (payouts, colours, groups). */
rouletteRouter.get("/board", (_req, res) => {
  const numbers = Array.from({ length: 37 }, (_, n) => ({ number: n, color: colorOf(n) }));
  res.json({
    numbers,
    payouts: {
      straight: 35, split: 17, street: 11, corner: 8, line: 5,
      dozen: 2, column: 2, red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1,
    },
    groups: {
      dozens: [1, 2, 3].map((g) => ({ group: g, numbers: expandGroup("dozen", g as 1 | 2 | 3) })),
      columns: [1, 2, 3].map((g) => ({ group: g, numbers: expandGroup("column", g as 1 | 2 | 3) })),
    },
  });
});
