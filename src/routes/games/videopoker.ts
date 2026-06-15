import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { applyLedgerEntry, InsufficientFundsError, levelFromXp, xpForWager } from "../../lib/wallet";
import { videoPokerRounds, VideoPokerActiveRound } from "../../lib/activeRounds";
import { hashServerSeed } from "../../lib/provablyFair";
import {
  dealVideoPokerDeck,
  evaluateHand,
  PAY_TABLE,
} from "../../games/videopoker";

export const videoPokerRouter = Router();

const dealSchema = z.object({ amount: z.number().int().positive() });

videoPokerRouter.post("/deal", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = dealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const userId = req.userId!;
  if (videoPokerRounds.has(userId)) {
    return res.status(409).json({ error: "You already have an active Video Poker hand — draw first" });
  }

  const { amount } = parsed.data;

  try {
    const round = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await applyLedgerEntry(tx, userId, "bet", -amount, undefined);
      await tx.user.update({ where: { id: userId }, data: { nonce: { increment: 1 } } });

      const deck = dealVideoPokerDeck(user.serverSeed, user.clientSeed, user.nonce);
      const hand = deck.slice(0, 5);

      const active: VideoPokerActiveRound = {
        deck,
        hand,
        bet: amount,
        serverSeed: user.serverSeed,
        clientSeed: user.clientSeed,
        nonce: user.nonce,
        startedAt: Date.now(),
      };
      return active;
    });

    videoPokerRounds.set(userId, round);
    const balance = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance;

    res.status(201).json({
      balance,
      hand: round.hand,
      fairness: {
        serverSeedHash: hashServerSeed(round.serverSeed),
        clientSeed: round.clientSeed,
        nonce: round.nonce,
      },
      nextNonce: round.nonce + 1,
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    throw err;
  }
});

const drawSchema = z.object({
  hold: z.array(z.boolean()).length(5),
});

videoPokerRouter.post("/draw", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const round = videoPokerRounds.get(userId);
  if (!round) return res.status(404).json({ error: "No active Video Poker hand — deal first" });

  const parsed = drawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { hold } = parsed.data;

  // Replace non-held cards with the next cards from the deck (starting at index 5)
  let drawCursor = 5;
  const finalHand = round.hand.map((card, i) => {
    if (hold[i]) return card;
    return round.deck[drawCursor++];
  });

  const handRank = evaluateHand(finalHand);
  const multiplier = PAY_TABLE[handRank];
  const payout = Math.floor(round.bet * multiplier);

  videoPokerRounds.clear(userId);
  const settled = await settleVideoPoker(userId, round, finalHand, handRank, multiplier, payout);

  res.json({
    hand: finalHand,
    handRank,
    multiplier,
    payout,
    balance: settled.balance,
    level: settled.level,
    xp: settled.xp,
    leveledUp: settled.leveledUp,
    betId: settled.betId,
  });
});

videoPokerRouter.get("/active", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const round = videoPokerRounds.get(req.userId!);
  if (!round) return res.status(404).json({ error: "No active Video Poker hand" });

  res.json({
    hand: round.hand,
    bet: round.bet,
    fairness: {
      serverSeedHash: hashServerSeed(round.serverSeed),
      clientSeed: round.clientSeed,
      nonce: round.nonce,
    },
  });
});

// ---------------------------------------------------------------------------

async function settleVideoPoker(
  userId: string,
  round: VideoPokerActiveRound,
  finalHand: VideoPokerActiveRound["hand"],
  handRank: string,
  multiplier: number,
  payout: number
) {
  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (payout > 0) {
      user = await applyLedgerEntry(tx, userId, "payout", payout, undefined);
    }

    const gainedXp = xpForWager(round.bet);
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
        game: "videopoker",
        amount: round.bet,
        payout,
        multiplier,
        result: payout > 0 ? "win" : "loss",
        state: JSON.stringify({
          initialHand: round.hand,
          finalHand,
          handRank,
        }),
        clientSeed: round.clientSeed,
        serverSeed: round.serverSeed,
        nonce: round.nonce,
      },
    });

    return {
      betId: bet.id,
      balance: user.balance,
      level: user.level,
      xp: user.xp,
      leveledUp,
    };
  });
}
