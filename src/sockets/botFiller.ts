import crypto from "crypto";

/**
 * Shared helpers for the synthetic "filler" players that keep the live
 * multiplayer lobbies from ever looking empty.
 *
 * House rules for every bot in this codebase (matching the board-games engine):
 *  - A bot id always starts with "bot-" so engines can tell it apart from a
 *    real user id at a glance (see {@link isBotId}).
 *  - Bots NEVER touch the chip ledger. They are never deducted for their
 *    stakes and never credited for their winnings. A human always plays at the
 *    normal posted odds; the bot is just a free synthetic opponent / filler.
 *  - Because of that, no bot id is ever passed to applyLedgerEntry().
 */

const FIRST = [
  "Lucky", "Mister", "Crypto", "Neon", "Shadow", "Turbo", "Golden", "Silent",
  "Wild", "Frosty", "Diamond", "Captain", "Major", "Royal", "Iron", "Crimson",
  "Midnight", "Solar", "Atomic", "Velvet", "Rapid", "Cosmic", "Grizzly", "Echo",
  "Pixel", "Quantum", "Rogue", "Stealth", "Vapor", "Blitz", "Maverick", "Phantom",
];
const SECOND = [
  "Wolf", "Ace", "King", "Shark", "Tiger", "Falcon", "Viper", "Joker",
  "Raven", "Dragon", "Bandit", "Hunter", "Ghost", "Knight", "Comet", "Bear",
  "Fox", "Hawk", "Cobra", "Lynx", "Panther", "Rhino", "Stag", "Mako",
  "Reaper", "Saint", "Titan", "Wizard", "Nomad", "Outlaw", "Drifter", "Sniper",
];

/** A synthetic player identity. `id` is always prefixed "bot-". */
export interface Bot {
  id: string;
  username: string;
}

/** True if this id belongs to a synthetic filler player (never a real user). */
export function isBotId(id: string | undefined | null): boolean {
  return typeof id === "string" && id.startsWith("bot-");
}

/**
 * Mint a fresh bot identity. `taken` (optional) is a set of usernames already
 * in use so the same table/round never shows two identical names.
 */
export function makeBot(taken?: Set<string>): Bot {
  for (let attempt = 0; attempt < 12; attempt++) {
    const name = `${pick(FIRST)}${pick(SECOND)}${randInt(1, 99)}`;
    if (!taken || !taken.has(name)) {
      taken?.add(name);
      return { id: `bot-${crypto.randomUUID()}`, username: name };
    }
  }
  // Fall back to a guaranteed-unique numeric suffix if we kept colliding.
  const name = `${pick(FIRST)}${pick(SECOND)}${randInt(100, 9999)}`;
  taken?.add(name);
  return { id: `bot-${crypto.randomUUID()}`, username: name };
}

/** Random integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * A believable bot stake in cents. Bots bet in whole chips (1 chip = 100
 * cents). `minChips`/`maxChips` bound the range; the distribution is skewed
 * toward smaller bets so the feed looks like real players.
 */
export function botStakeCents(minChips = 1, maxChips = 200): number {
  const span = maxChips - minChips;
  // Square the roll to bias toward the low end.
  const chips = minChips + Math.floor(Math.pow(Math.random(), 2) * span);
  return Math.max(minChips, chips) * 100;
}

/** Pick a random element of a non-empty array. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Resolve after a random delay in [minMs, maxMs]. */
export function botDelay(minMs: number, maxMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, randInt(minMs, maxMs)));
}
