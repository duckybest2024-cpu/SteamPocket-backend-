import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { placeBet, BadBetInputError } from "../../lib/betting";
import { InsufficientFundsError } from "../../lib/wallet";
import { evaluateSpin, spinGrid, validateSlotsBet, MAX_LINES, MIN_LINES } from "../../games/slots";

export const slotsRouter = Router();

const spinSchema = z.object({
  lineBet: z.number().int().positive(),
  lines: z.number().int().min(MIN_LINES).max(MAX_LINES),
  spinSalt: z.string().max(32).optional(), // client-supplied per-spin entropy that breaks sequential patterns
});

slotsRouter.post("/spin", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = spinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { lineBet, lines, spinSalt } = parsed.data;
  const validation = validateSlotsBet(lines);
  if (validation) return res.status(400).json({ error: validation });

  const totalStake = lineBet * lines;

  try {
    const placed = await placeBet(req.userId!, "slots", totalStake, (seeds) => {
      const effectiveClientSeed = spinSalt ? `${seeds.clientSeed}:${spinSalt}` : seeds.clientSeed;
      const grid = spinGrid(seeds.serverSeed, effectiveClientSeed, seeds.nonce);
      const spin = evaluateSpin(grid, lines);

      // Total payout = (line wins, in line-bet units) * lineBet  +  (scatter win, in total-bet units).
      const payout = Math.floor(spin.totalWinUnits * lineBet) + Math.floor(spin.scatterPayout * totalStake);

      return {
        payout,
        multiplier: totalStake > 0 ? Number((payout / totalStake).toFixed(4)) : 0,
        result: payout >= totalStake ? "win" : "loss",
        state: {
          grid: spin.grid,
          lineBet,
          lines,
          lineWins: spin.lineWins,
          scatterCount: spin.scatterCount,
          scatterPayout: spin.scatterPayout,
          freeSpinsAwarded: spin.freeSpinsAwarded,
        },
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

/** Reference data for the client to render the paytable & payline overlays. */
slotsRouter.get("/info", (_req, res) => {
  res.json({
    reels: 5,
    rows: 3,
    maxLines: MAX_LINES,
    symbols: ["wild", "scatter", "crown", "gem", "bell", "clover", "horseshoe", "ace", "king", "queen"],
    rules: [
      "Wilds substitute for any paying symbol and double the line win for each wild in the combo.",
      "Scatters pay on any position: 3 = 5x, 4 = 25x, 5 = 100x total bet, and 3+ award 10 free spins.",
      "Line wins pay left-to-right starting from reel 1; only the highest combo per line counts.",
    ],
  });
});
