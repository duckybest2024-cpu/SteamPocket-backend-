import { Router } from "express";
import { requireAuth, requireApproved, AuthedRequest } from "../middleware/auth";
import { placeBet, BadBetInputError } from "../lib/betting";
import { floatFromSeed } from "../lib/provablyFair";
import { InsufficientFundsError } from "../lib/wallet";

export const arcadeRouter = Router();

interface PayoutEntry {
  prob: number;
  mult: number;
  label: string;
}

interface ArcadeGameDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  table: PayoutEntry[];
}

const ARCADE_GAMES: ArcadeGameDef[] = [
  {
    id: "claw_classic",
    name: "Claw Machine Classic",
    emoji: "🎮",
    description: "Drop the claw and grab a prize!",
    table: [
      { prob: 0.50, mult: 0,  label: "Claw missed!" },
      { prob: 0.25, mult: 1,  label: "Small toy 🧸" },
      { prob: 0.18, mult: 2,  label: "Medium toy 🐻" },
      { prob: 0.06, mult: 4,  label: "Big prize! 🎁" },
      { prob: 0.01, mult: 12, label: "JACKPOT! 🏆" },
    ],
  },
  {
    id: "claw_deluxe",
    name: "Claw Crane Deluxe",
    emoji: "🦾",
    description: "Precision claw with X/Y positioning",
    table: [
      { prob: 0.45, mult: 0,   label: "Missed!" },
      { prob: 0.20, mult: 0.5, label: "Consolation prize 🎠" },
      { prob: 0.20, mult: 1,   label: "Small prize 🧸" },
      { prob: 0.10, mult: 3,   label: "Medium prize 🐻" },
      { prob: 0.04, mult: 8,   label: "Large prize! 🎁" },
      { prob: 0.01, mult: 5,   label: "JACKPOT! 🏆" },
    ],
  },
  {
    id: "capsule_gacha",
    name: "Capsule Gacha",
    emoji: "💊",
    description: "Turn the dial for a random capsule",
    table: [
      { prob: 0.05, mult: 0,   label: "Empty capsule 😢" },
      { prob: 0.40, mult: 0.5, label: "Common prize 🔵" },
      { prob: 0.35, mult: 1,   label: "Uncommon prize 🟢" },
      { prob: 0.15, mult: 2,   label: "Rare prize 🟣" },
      { prob: 0.04, mult: 2.5, label: "Epic prize ✨" },
      { prob: 0.01, mult: 2,   label: "Legendary prize 🌟" },
    ],
  },
  {
    id: "magic_egg",
    name: "Magic Egg Drop",
    emoji: "🥚",
    description: "Drop magic eggs and land on prizes",
    table: [
      { prob: 0.20, mult: 0,   label: "Broken egg 💔" },
      { prob: 0.30, mult: 0.5, label: "Small prize 🍬" },
      { prob: 0.30, mult: 1,   label: "Medium prize 🎈" },
      { prob: 0.15, mult: 2,   label: "Large prize 🎁" },
      { prob: 0.04, mult: 5,   label: "Lucky egg! 🌟" },
      { prob: 0.01, mult: 2,   label: "Golden egg! 🥇" },
    ],
  },
  {
    id: "fantasy_star",
    name: "Fantasy Star Ball",
    emoji: "⭐",
    description: "Themed ball machine with star prizes",
    table: [
      { prob: 0.42, mult: 0,   label: "No prize" },
      { prob: 0.28, mult: 1,   label: "Star prize ⭐" },
      { prob: 0.18, mult: 1.5, label: "Silver star 🌟" },
      { prob: 0.08, mult: 3,   label: "Gold star 💫" },
      { prob: 0.03, mult: 4,   label: "Rainbow star! 🌈" },
      { prob: 0.01, mult: 7,   label: "SUPER STAR! 🚀" },
    ],
  },
  {
    id: "ticket_blaster",
    name: "Ticket Blaster",
    emoji: "🎯",
    description: "Shoot targets to win chip tickets",
    table: [
      { prob: 0.25, mult: 0,   label: "Missed all targets!" },
      { prob: 0.30, mult: 0.5, label: "5 tickets 🎫" },
      { prob: 0.22, mult: 1,   label: "10 tickets 🎫🎫" },
      { prob: 0.14, mult: 2,   label: "20 tickets 🎫🎫🎫" },
      { prob: 0.07, mult: 3,   label: "Bullseye! 🎯" },
      { prob: 0.02, mult: 5,   label: "JACKPOT BLAST! 💥" },
    ],
  },
  {
    id: "stacker",
    name: "Stacker",
    emoji: "📦",
    description: "Stack blocks perfectly to win the jackpot",
    table: [
      { prob: 0.50, mult: 0,  label: "Stack toppled! 😢" },
      { prob: 0.25, mult: 1,  label: "3-block stack 📦" },
      { prob: 0.15, mult: 2,  label: "6-block stack 📦📦" },
      { prob: 0.07, mult: 3,  label: "9-block stack! 📦📦📦" },
      { prob: 0.02, mult: 5,  label: "Perfect stack! ⭐" },
      { prob: 0.01, mult: 10, label: "JACKPOT! 🏆" },
    ],
  },
  {
    id: "basketball",
    name: "Basketball Toss",
    emoji: "🏀",
    description: "Shoot hoops for chip prizes",
    table: [
      { prob: 0.45, mult: 0,   label: "Air ball! 😢" },
      { prob: 0.25, mult: 1,   label: "Basket! 🏀" },
      { prob: 0.18, mult: 1.5, label: "Swish! 🎯" },
      { prob: 0.09, mult: 3,   label: "3-pointer! ⭐" },
      { prob: 0.02, mult: 5,   label: "Half-court shot! 🏆" },
      { prob: 0.01, mult: 7,   label: "BUZZER BEATER! 🎉" },
    ],
  },
  {
    id: "whack_mole",
    name: "Whack-a-Mole",
    emoji: "💨",
    description: "Whack moles as fast as you can!",
    table: [
      { prob: 0.25, mult: 0,  label: "Missed all moles!" },
      { prob: 0.30, mult: 0.5, label: "1 mole hit 💨" },
      { prob: 0.25, mult: 1,  label: "3 moles hit 💨💨💨" },
      { prob: 0.15, mult: 2,  label: "5 moles hit! 🎯" },
      { prob: 0.04, mult: 4,  label: "Mole frenzy! 🌟" },
      { prob: 0.01, mult: 10, label: "PERFECT ROUND! 🏆" },
    ],
  },
  {
    id: "fishing",
    name: "Fishing Frenzy",
    emoji: "🎣",
    description: "Cast your line and reel in prizes",
    table: [
      { prob: 0.30, mult: 0,   label: "Nothing biting... 🌊" },
      { prob: 0.25, mult: 0.5, label: "Tiny fish 🐟" },
      { prob: 0.25, mult: 1,   label: "Medium fish 🐠" },
      { prob: 0.14, mult: 2,   label: "Big catch! 🐡" },
      { prob: 0.05, mult: 4,   label: "Rare fish! 🦈" },
      { prob: 0.01, mult: 12,  label: "LEGENDARY CATCH! 🏆" },
    ],
  },
  {
    id: "lucky_punch",
    name: "Lucky Punch",
    emoji: "👊",
    description: "Hit the target with perfect timing",
    table: [
      { prob: 0.30, mult: 0,   label: "Missed! 💨" },
      { prob: 0.28, mult: 0.5, label: "Weak hit 👊" },
      { prob: 0.22, mult: 1,   label: "Good hit! 💪" },
      { prob: 0.15, mult: 2,   label: "Strong punch! 🥊" },
      { prob: 0.04, mult: 5,   label: "Knockout! ⭐" },
      { prob: 0.01, mult: 12,  label: "MEGA PUNCH! 🏆" },
    ],
  },
  {
    id: "coin_pusher",
    name: "Coin Pusher",
    emoji: "🪙",
    description: "Push coins off the ledge to collect",
    table: [
      { prob: 0.22, mult: 0,   label: "No coins fell 😢" },
      { prob: 0.30, mult: 0.5, label: "2 coins 🪙🪙" },
      { prob: 0.26, mult: 1,   label: "5 coins 🪙🪙🪙" },
      { prob: 0.14, mult: 2,   label: "10 coins! 💰" },
      { prob: 0.06, mult: 3,   label: "Coin avalanche! 🎰" },
      { prob: 0.02, mult: 5,   label: "JACKPOT COINS! 🏆" },
    ],
  },
  {
    id: "prize_ladder",
    name: "Prize Ladder",
    emoji: "🪜",
    description: "Click to stop the climbing prize indicator",
    table: [
      { prob: 0.28, mult: 0,   label: "No prize 😢" },
      { prob: 0.30, mult: 0.5, label: "Rung 2 🪜" },
      { prob: 0.22, mult: 1,   label: "Rung 4 🪜🪜" },
      { prob: 0.14, mult: 2,   label: "Rung 6! ⭐" },
      { prob: 0.05, mult: 4,   label: "Top rung! 🌟" },
      { prob: 0.01, mult: 12,  label: "JACKPOT RUNG! 🏆" },
    ],
  },
  {
    id: "crane_master",
    name: "Crane Master",
    emoji: "🏗️",
    description: "Precision crane targeting challenge",
    table: [
      { prob: 0.50, mult: 0,  label: "Crane missed! 🏗️" },
      { prob: 0.25, mult: 1,  label: "Grabbed it! 📦" },
      { prob: 0.15, mult: 2,  label: "Perfect grab! ⭐" },
      { prob: 0.07, mult: 3,  label: "Master crane! 🌟" },
      { prob: 0.02, mult: 5,  label: "Precision elite! 📎" },
      { prob: 0.01, mult: 10, label: "GRAND MASTER! 🏆" },
    ],
  },
  {
    id: "egg_machine",
    name: "Magic Egg Machine",
    emoji: "🪄",
    description: "Mystery egg machine with surprise prizes",
    table: [
      { prob: 0.20, mult: 0,   label: "Empty machine 😢" },
      { prob: 0.35, mult: 0.5, label: "Common egg 🥚" },
      { prob: 0.28, mult: 1,   label: "Spotted egg 🐣" },
      { prob: 0.12, mult: 2,   label: "Rainbow egg 🌈" },
      { prob: 0.04, mult: 4,   label: "Golden egg! 💛" },
      { prob: 0.01, mult: 12,  label: "DRAGON EGG! 🐉" },
    ],
  },
];

function resolveFromTable(rng: number, table: PayoutEntry[]): PayoutEntry {
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.prob;
    if (rng < cumulative) return entry;
  }
  return table[table.length - 1];
}

arcadeRouter.get("/games", (_req, res) => {
  res.json({
    games: ARCADE_GAMES.map(g => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      description: g.description,
    })),
  });
});

arcadeRouter.post("/:gameId/play", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const { gameId } = req.params;
  const game = ARCADE_GAMES.find(g => g.id === gameId);
  if (!game) return res.status(404).json({ error: "Game not found" });

  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive integer (cents)" });
  }

  try {
    const placed = await placeBet(req.userId!, `arcade_${gameId}`, amount, (seeds) => {
      const rng = floatFromSeed(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
      const outcome = resolveFromTable(rng, game.table);
      const payout = Math.floor(amount * outcome.mult);
      return {
        payout,
        multiplier: outcome.mult,
        result: payout > 0 ? "win" : "loss",
        state: { rng, label: outcome.label, mult: outcome.mult },
      };
    });

    res.json({
      result: placed.resolution.result,
      label: (placed.resolution.state as { label: string }).label,
      multiplier: placed.resolution.multiplier,
      payout: placed.resolution.payout,
      balance: placed.balance,
      level: placed.level,
      xp: placed.xp,
      leveledUp: placed.leveledUp,
      bet: placed.bet,
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    if (err instanceof BadBetInputError) return res.status(400).json({ error: err.message });
    console.error("Arcade game error:", err);
    res.status(500).json({ error: "Game error — please try again" });
  }
});
