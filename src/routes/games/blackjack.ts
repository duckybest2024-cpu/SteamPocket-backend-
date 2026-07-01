import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { applyLedgerEntry, InsufficientFundsError, levelFromXp, xpForWager } from "../../lib/wallet";
import { blackjackRounds, BlackjackActiveRound } from "../../lib/activeRounds";
import { hashServerSeed } from "../../lib/provablyFair";
import {
  freshShoe,
  startRound,
  dealCard,
  canSplit,
  canDouble,
  handValue,
  isBust,
  playDealerHand,
  settleHands,
  BlackjackState,
  BlackjackHand,
} from "../../games/blackjack";

export const blackjackRouter = Router();

const startSchema = z.object({ amount: z.number().int().positive() });

blackjackRouter.post("/start", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const userId = req.userId!;
  if (blackjackRounds.has(userId)) return res.status(409).json({ error: "Finish your current hand first" });

  const { amount } = parsed.data;

  try {
    const round = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await applyLedgerEntry(tx, userId, "bet", -amount, undefined);
      await tx.user.update({ where: { id: userId }, data: { nonce: { increment: 1 } } });

      const shoe = freshShoe(user.serverSeed, user.clientSeed, user.nonce);
      const state = startRound(shoe, amount);

      const active: BlackjackActiveRound = {
        state,
        serverSeed: user.serverSeed,
        clientSeed: user.clientSeed,
        nonce: user.nonce,
        startedAt: Date.now(),
      };
      return active;
    });

    if (round.state.status === "settled") {
      // Player blackjack against a non-blackjack dealer never happens here (settled only on
      // double-blackjack push or dealer blackjack loss) — but guard the path for completeness.
      const result = await finishRound(userId, round);
      return res.status(201).json({ finished: true, ...result });
    }

    blackjackRounds.set(userId, round);
    const balance = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance;
    res.status(201).json({ finished: false, balance, table: publicTable(round, false) });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    throw err;
  }
});

blackjackRouter.get("/active", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const round = blackjackRounds.get(req.userId!);
  if (!round) return res.status(404).json({ error: "No active hand" });
  res.json({ table: publicTable(round, false) });
});

const actionSchema = z.object({ action: z.enum(["hit", "stand", "double", "split", "surrender", "insurance"]) });

blackjackRouter.post("/action", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const round = blackjackRounds.get(userId);
  if (!round) return res.status(404).json({ error: "No active hand — start one first" });

  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { state } = round;
  const hand = state.hands[state.activeHand];
  if (!hand || hand.status !== "playing") return res.status(400).json({ error: "Active hand is not awaiting action" });

  try {
    switch (parsed.data.action) {
      case "hit":
        await applyHit(hand, state);
        break;
      case "stand":
        hand.status = "stood";
        break;
      case "double":
        await applyDouble(userId, hand, state);
        break;
      case "split":
        await applySplit(userId, hand, state);
        break;
      case "surrender":
        if (hand.cards.length !== 2 || state.hands.length > 1) {
          return res.status(400).json({ error: "Surrender is only available on your initial two-card hand" });
        }
        hand.status = "surrendered";
        break;
      case "insurance":
        if (!state.insuranceOffered || state.insuranceTaken || state.hands.length > 1 || hand.cards.length !== 2) {
          return res.status(400).json({ error: "Insurance is not available right now" });
        }
        await applyInsurance(userId, state);
        break;
    }
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    if (err instanceof BadAction) return res.status(400).json({ error: err.message });
    throw err;
  }

  advanceIfNeeded(state);

  if (state.status === "settled") {
    blackjackRounds.clear(userId);
    const result = await finishRound(userId, round);
    return res.json({ finished: true, ...result });
  }

  blackjackRounds.set(userId, round);
  res.json({ finished: false, table: publicTable(round, false) });
});

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function applyHit(hand: BlackjackHand, state: BlackjackState) {
  hand.cards.push(dealCard(state));
  if (isBust(hand.cards)) hand.status = "bust";
  else if (handValue(hand.cards).total === 21) hand.status = "stood";
}

async function applyDouble(userId: string, hand: BlackjackHand, state: BlackjackState) {
  if (!canDouble(hand)) throw new BadAction("Double down is only available on a fresh two-card hand");
  await prisma.$transaction((tx) => applyLedgerEntry(tx, userId, "bet", -hand.bet, undefined));
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(dealCard(state));
  hand.status = isBust(hand.cards) ? "bust" : "stood";
}

async function applySplit(userId: string, hand: BlackjackHand, state: BlackjackState) {
  if (!canSplit(hand)) throw new BadAction("This hand cannot be split");
  if (state.hands.length >= 4) throw new BadAction("Maximum of 4 hands reached");

  await prisma.$transaction((tx) => applyLedgerEntry(tx, userId, "bet", -hand.bet, undefined));

  const [first, second] = hand.cards;
  const newHand: BlackjackHand = { cards: [second], bet: hand.bet, status: "playing", doubled: false };
  hand.cards = [first];

  hand.cards.push(dealCard(state));
  newHand.cards.push(dealCard(state));

  // Splitting Aces: standard rule — exactly one card per hand, then both stand automatically.
  if (first.rank === "A") {
    hand.status = "stood";
    newHand.status = "stood";
  } else if (handValue(hand.cards).total === 21) {
    hand.status = "stood";
  }

  state.hands.splice(state.activeHand + 1, 0, newHand);
}

async function applyInsurance(userId: string, state: BlackjackState) {
  const insuranceCost = Math.floor(state.baseBet / 2);
  await prisma.$transaction(async (tx) => {
    await applyLedgerEntry(tx, userId, "bet", -insuranceCost, undefined);

    if (handValue(state.dealer).total === 21 && state.dealer.length === 2) {
      // Dealer reveals blackjack immediately — insurance pays 2:1 (stake back + 2x win).
      await applyLedgerEntry(tx, userId, "payout", insuranceCost * 3, "insurance");
    }
  });
  state.insuranceTaken = true;
}

class BadAction extends Error {}

/** Move to the next hand (for splits) or kick off the dealer's turn once everyone has acted. */
function advanceIfNeeded(state: BlackjackState) {
  while (state.activeHand < state.hands.length && state.hands[state.activeHand].status !== "playing") {
    state.activeHand += 1;
  }
  if (state.activeHand >= state.hands.length) {
    playDealerHand(state);
  }
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

async function finishRound(userId: string, round: BlackjackActiveRound) {
  const settlements = settleHands(round.state);
  const totalPayout = settlements.reduce((sum, s) => sum + s.payout, 0);
  const totalWagered = round.state.hands.reduce((sum, h) => sum + h.bet, 0);

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (totalPayout > 0) {
      user = await applyLedgerEntry(tx, userId, "payout", totalPayout, undefined);
    }

    const gainedXp = xpForWager(totalWagered);
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

    const overallResult = totalPayout > totalWagered ? "win" : "loss";
    const bet = await tx.bet.create({
      data: {
        userId,
        game: "blackjack",
        amount: totalWagered,
        payout: totalPayout,
        multiplier: totalWagered > 0 ? Number((totalPayout / totalWagered).toFixed(4)) : 0,
        result: overallResult,
        state: JSON.stringify({
          dealer: round.state.dealer,
          hands: round.state.hands,
          settlements,
        }),
        clientSeed: round.clientSeed,
        serverSeed: round.serverSeed,
        nonce: round.nonce,
      },
    });

    return {
      betId: bet.id,
      payout: totalPayout,
      balance: user.balance,
      level: user.level,
      xp: user.xp,
      leveledUp,
      table: publicTable(round, true),
      settlements,
    };
  });
}

// ---------------------------------------------------------------------------
// View serialisation
// ---------------------------------------------------------------------------

function publicTable(round: BlackjackActiveRound, revealHole: boolean) {
  const { state } = round;
  const dealerCards = revealHole || state.status !== "player_turn" ? state.dealer : [state.dealer[0]];
  const dealerValue = revealHole || state.status !== "player_turn" ? handValue(state.dealer) : null;

  return {
    status: state.status,
    activeHand: state.activeHand,
    insuranceOffered: state.insuranceOffered,
    insuranceTaken: state.insuranceTaken,
    dealer: { cards: dealerCards, value: dealerValue, holeHidden: !(revealHole || state.status !== "player_turn") },
    hands: state.hands.map((hand) => ({
      cards: hand.cards,
      bet: hand.bet,
      status: hand.status,
      doubled: hand.doubled,
      value: handValue(hand.cards),
      canHit: hand.status === "playing",
      canStand: hand.status === "playing",
      canDouble: hand.status === "playing" && canDouble(hand),
      canSplit: hand.status === "playing" && canSplit(hand),
    })),
    fairness: {
      serverSeedHash: hashServerSeed(round.serverSeed),
      clientSeed: round.clientSeed,
      nonce: round.nonce,
    },
  };
}
