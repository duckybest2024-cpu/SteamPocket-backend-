/**
 * In-progress multi-step rounds (Mines, Blackjack) live here rather than in the database —
 * they're ephemeral, single-player, and resolved within seconds to minutes. Persisting every
 * intermediate "revealed tile" or "hit" would bloat the ledger for no benefit; only the final,
 * settled outcome becomes a `Bet` row. One active round per (game, user) at a time, which
 * mirrors how every real casino UI works — you can't open two mines boards simultaneously.
 *
 * NOTE: this is a single-process store. A horizontally-scaled deployment would swap this for
 * Redis with the same key shape (`${game}:${userId}`) without touching call sites.
 */
class ActiveRoundStore<T> {
  private rounds = new Map<string, T>();

  constructor(private game: string) {}

  private key(userId: string): string {
    return `${this.game}:${userId}`;
  }

  get(userId: string): T | undefined {
    return this.rounds.get(this.key(userId));
  }

  set(userId: string, round: T): void {
    this.rounds.set(this.key(userId), round);
  }

  clear(userId: string): void {
    this.rounds.delete(this.key(userId));
  }

  delete(userId: string): void {
    this.rounds.delete(this.key(userId));
  }

  has(userId: string): boolean {
    return this.rounds.has(this.key(userId));
  }
}

export interface MinesActiveRound {
  betId: string; // placeholder id generated up front; becomes the real Bet.id on settlement
  amount: number;
  mineCount: number;
  mines: number[];
  revealed: number[];
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  startedAt: number;
}

export const minesRounds = new ActiveRoundStore<MinesActiveRound>("mines");

import type { BlackjackState } from "../games/blackjack";

export interface BlackjackActiveRound {
  state: BlackjackState;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  startedAt: number;
}

export const blackjackRounds = new ActiveRoundStore<BlackjackActiveRound>("blackjack");

import type { Card as HiloCard } from "../games/hilo";

export interface HiloActiveRound {
  deck: HiloCard[];
  position: number;
  currentMultiplier: number;
  bet: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  startedAt: number;
}

export const hiloRounds = new ActiveRoundStore<HiloActiveRound>("hilo");

import type { Card as VPCard } from "../games/videopoker";

export interface VideoPokerActiveRound {
  deck: VPCard[];
  hand: VPCard[];
  bet: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  startedAt: number;
}

export const videoPokerRounds = new ActiveRoundStore<VideoPokerActiveRound>("videopoker");
