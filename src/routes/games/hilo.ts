import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { applyLedgerEntry, InsufficientFundsError, levelFromXp, xpForWager } from "../../lib/wallet";
import { hiloRounds, HiloActiveRound } from "../../lib/activeRounds";
import { hashServerSeed } from "../../lib/provablyFair";
import {
  dealHiloDeck,
  rankOrder,
  hiloMultiplierFactor,
  hiloOutcome,
  countHigher,
  countLower,
  Card,
} from "../../games/hilo";

export const hiloRouter = Router();

const startSchema = z.object({ amount: z.number().int().positive() });

hiloRouter.post("/start", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const userId = req.userId!;
  if (hiloRounds.has(userId)) {
    return res.status(409).json({ error: "You already have an active Hi-Lo round — cash out or bust first" });
  }

  const { amount } = parsed.data;

  try {
    const round = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await applyLedgerEntry(tx, userId, "bet", -amount, undefined);
      await tx.user.update({ where: { id: userId }, data: { nonce: { increment: 1 } } });

      const deck = dealHiloDeck(user.serverSeed, user.clientSeed, user.nonce);

      const active: HiloActiveRound = {
        deck,
        position: 1,
        currentMultiplier: 1.0,
        bet: amount,
        serverSeed: user.serverSeed,
        clientSeed: user.clientSeed,
        nonce: user.nonce,
        startedAt: Date.now(),
      };
      return active;
    });

    hiloRounds.set(userId, round);
    const balance = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance;
    const firstCard = round.deck[0];
    const remaining = round.deck.slice(1);

    res.status(201).json({
      balance,
      card: firstCard,
      currentMultiplier: round.currentMultiplier,
      canHigher: rankOrder(firstCard.rank) < 14,
      canLower: rankOrder(firstCard.rank) > 2,
      position: 0,
      fairness: {
        serverSeedHash: hashServerSeed(round.serverSeed),
        clientSeed: round.clientSeed,
        nonce: round.nonce,
      },
      nextNonce: round.nonce + 1,
      higherChance: Number((countHigher(firstCard, remaining) / remaining.length).toFixed(4)),
      lowerChance: Number((countLower(firstCard, remaining) / remaining.length).toFixed(4)),
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    throw err;
  }
});

const actionSchema = z.object({
  action: z.enum(["higher", "lower", "cashout"]),
});

hiloRouter.post("/action", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const round = hiloRounds.get(userId);
  if (!round) return res.status(404).json({ error: "No active Hi-Lo round — start one first" });

  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { action } = parsed.data;

  // --- Cashout ---
  if (action === "cashout") {
    hiloRounds.clear(userId);
    const payout = Math.floor(round.bet * round.currentMultiplier);
    const settled = await settleHilo(userId, round, payout);
    return res.json({
      finished: true,
      outcome: "win",
      payout,
      ...settled,
    });
  }

  // --- Higher / Lower ---
  const currentCard = round.deck[round.position - 1];
  const nextCard = round.deck[round.position];

  if (!nextCard) {
    // Deck exhausted — treat as auto-cashout
    hiloRounds.clear(userId);
    const payout = Math.floor(round.bet * round.currentMultiplier);
    const settled = await settleHilo(userId, round, payout);
    return res.json({
      finished: true,
      outcome: "win",
      payout,
      ...settled,
    });
  }

  const outcome = hiloOutcome(currentCard, nextCard, action);
  const remaining = round.deck.slice(round.position + 1); // cards still in deck after this draw

  if (outcome === "wrong") {
    hiloRounds.clear(userId);
    const settled = await settleHilo(userId, round, 0);
    return res.json({
      finished: true,
      outcome: "bust",
      card: nextCard,
      payout: 0,
      correct: false,
      ...settled,
    });
  }

  // Correct or push — advance position
  round.position += 1;

  if (outcome === "correct") {
    // Update multiplier: factor based on win probability from *before* this draw
    // remaining cards for probability = deck after the card we just drew was revealed
    const remainingBeforeDraw = round.deck.slice(round.position - 1); // excludes nextCard (it was drawn)
    // Actually: probability should be computed over cards that were still unseen when guess was made
    // = deck[position..end] before the draw, i.e., round.deck.slice(old position)
    const unseenBeforeGuess = round.deck.slice(round.position - 1);
    const factor = hiloMultiplierFactor(currentCard, action, unseenBeforeGuess);
    round.currentMultiplier = Number((round.currentMultiplier * factor).toFixed(6));
  }
  // push: multiplier stays the same

  hiloRounds.set(userId, round);

  // Compute next-card hints
  const higherChance = remaining.length > 0
    ? Number((countHigher(nextCard, remaining) / remaining.length).toFixed(4))
    : 0;
  const lowerChance = remaining.length > 0
    ? Number((countLower(nextCard, remaining) / remaining.length).toFixed(4))
    : 0;

  res.json({
    finished: false,
    correct: outcome === "correct",
    push: outcome === "push",
    card: nextCard,
    currentMultiplier: round.currentMultiplier,
    canHigher: rankOrder(nextCard.rank) < 14,
    canLower: rankOrder(nextCard.rank) > 2,
    position: round.position - 1,
    higherChance,
    lowerChance,
    fairness: {
      serverSeedHash: hashServerSeed(round.serverSeed),
      clientSeed: round.clientSeed,
      nonce: round.nonce,
    },
  });
});

hiloRouter.get("/active", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const round = hiloRounds.get(req.userId!);
  if (!round) return res.status(404).json({ error: "No active Hi-Lo round" });

  const currentCard = round.deck[round.position - 1];
  const remaining = round.deck.slice(round.position);

  res.json({
    card: currentCard,
    currentMultiplier: round.currentMultiplier,
    canHigher: rankOrder(currentCard.rank) < 14,
    canLower: rankOrder(currentCard.rank) > 2,
    position: round.position - 1,
    bet: round.bet,
    higherChance: remaining.length > 0
      ? Number((countHigher(currentCard, remaining) / remaining.length).toFixed(4))
      : 0,
    lowerChance: remaining.length > 0
      ? Number((countLower(currentCard, remaining) / remaining.length).toFixed(4))
      : 0,
    fairness: {
      serverSeedHash: hashServerSeed(round.serverSeed),
      clientSeed: round.clientSeed,
      nonce: round.nonce,
    },
  });
});

// ---------------------------------------------------------------------------

async function settleHilo(userId: string, round: HiloActiveRound, payout: number) {
  const multiplier = round.bet > 0 ? Number((payout / round.bet).toFixed(4)) : 0;

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
        game: "hilo",
        amount: round.bet,
        payout,
        multiplier,
        result: payout > 0 ? "win" : "loss",
        state: JSON.stringify({
          cardsRevealed: round.position,
          currentMultiplier: round.currentMultiplier,
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
