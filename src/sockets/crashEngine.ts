import { isOwner } from "../lib/owner";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry, levelFromXp, xpForWager, InsufficientFundsError } from "../lib/wallet";
import { generateCrashRound, multiplierAtElapsed } from "../games/crash";

const BETTING_DURATION_MS = 8_000;
const CRASHED_PAUSE_MS = 4_000;
const TICK_MS = 100;
const MAX_CRASH_MULTIPLIER = 1_000_000; // safety ceiling — curve is uncapped mathematically but rounds must end

type Phase = "betting" | "running" | "crashed";

interface RoundBet {
  userId: string;
  username: string;
  amount: number;
  autoCashout?: number; // optional — cash out automatically once the multiplier clears this
  cashedOutAt: number | null; // multiplier at which the player locked in, or null if still riding
  payout: number;
}

interface AuthedSocket extends Socket {
  data: { userId?: string; username?: string; isApproved?: boolean };
}

/**
 * Drives the perpetual Crash loop: betting window -> live multiplier climb -> crash -> repeat.
 * One instance, one room ("crash"), every connected client sees the exact same round at the
 * exact same multiplier — that shared tension (and the "I should've cashed out!" sting) is
 * what makes this the game people keep one tab open for.
 */
export class CrashEngine {
  private io: Server;
  private phase: Phase = "betting";
  private roundId = 0;
  private serverSeed = "";
  private serverSeedHash = "";
  private crashPoint = 1;
  private roundStartedAt = 0; // ms timestamp when the multiplier started climbing
  private phaseEndsAt = 0;
  private bets = new Map<string, RoundBet>(); // keyed by userId
  private history: { roundId: number; crashPoint: number; serverSeedHash: string }[] = [];
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor(io: Server) {
    this.io = io;
    this.attach();
  }

  private attach() {
    const namespace = this.io.of("/crash");

    namespace.use(async (socket: AuthedSocket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        try {
          const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
          const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true, isApproved: true, approvedUntil: true, isAdmin: true } });
          if (user) {
            socket.data.userId = user.id;
            socket.data.username = user.username;
            socket.data.isApproved = isOwner(user.username) || !!user.isAdmin || (user.isApproved && (!user.approvedUntil || user.approvedUntil > new Date()));
          }
        } catch {
          // Invalid token -> connect anonymously (spectators can still watch the feed).
        }
      }
      next();
    });

    namespace.on("connection", (socket: AuthedSocket) => {
      socket.join("crash");
      socket.emit("state", this.publicState());
      socket.emit("history", this.history);

      socket.on("place_bet", (payload, ack) => this.handlePlaceBet(socket, payload, ack));
      socket.on("cash_out", (_payload, ack) => this.handleCashOut(socket, ack));
    });

    void this.startBettingPhase();
  }

  // -------------------------------------------------------------------------
  // Round lifecycle
  // -------------------------------------------------------------------------

  private async startBettingPhase() {
    this.clearTick();
    this.phase = "betting";
    this.roundId += 1;
    this.bets = new Map();

    // Generate (and immediately publish the hash for) this round's outcome *before* anyone can
    // bet on it — that ordering is the entire fairness guarantee: the crash point is locked in
    // before a single wager exists, so the house cannot react to how much money is at stake.
    const round = generateCrashRound(`crash-round-${this.roundId}`, this.roundId);
    this.serverSeed = round.serverSeed;
    this.serverSeedHash = round.serverSeedHash;
    this.crashPoint = Math.min(round.crashPoint, MAX_CRASH_MULTIPLIER);

    this.phaseEndsAt = Date.now() + BETTING_DURATION_MS;
    this.broadcast("round_betting", {
      roundId: this.roundId,
      serverSeedHash: this.serverSeedHash,
      bettingEndsAt: this.phaseEndsAt,
    });

    setTimeout(() => void this.startRunningPhase(), BETTING_DURATION_MS);
  }

  private async startRunningPhase() {
    this.phase = "running";
    this.roundStartedAt = Date.now();

    await prisma.crashRound.create({
      data: {
        roundNumber: this.roundId,
        serverSeed: this.serverSeed,
        serverSeedHash: this.serverSeedHash,
        crashPoint: this.crashPoint,
        state: "running",
      },
    }).catch(() => {});

    this.broadcast("round_running", { roundId: this.roundId, startedAt: this.roundStartedAt });

    this.tickHandle = setInterval(() => void this.tick(), TICK_MS);
  }

  private async tick() {
    const elapsed = Date.now() - this.roundStartedAt;
    const multiplier = multiplierAtElapsed(elapsed);

    // Auto-cashouts: resolve anyone whose target the live multiplier has now reached.
    for (const bet of this.bets.values()) {
      if (bet.cashedOutAt === null && bet.autoCashout && multiplier >= bet.autoCashout) {
        await this.lockInCashout(bet, bet.autoCashout);
      }
    }

    if (multiplier >= this.crashPoint) {
      await this.crash();
      return;
    }

    this.broadcast("round_tick", { roundId: this.roundId, multiplier });
  }

  private async crash() {
    this.clearTick();
    this.phase = "crashed";

    await prisma.crashRound.updateMany({
      where: { roundNumber: this.roundId },
      data: { state: "crashed", endedAt: new Date() },
    }).catch(() => {});

    // Settle everyone still riding as a total loss, persist a Bet row per player for history/stats.
    const settlements: { userId: string; username: string; amount: number; payout: number; multiplier: number }[] = [];
    for (const bet of this.bets.values()) {
      const finalMultiplier = bet.cashedOutAt ?? 0;
      const payout = bet.cashedOutAt ? bet.payout : 0;
      await this.persistBet(bet, finalMultiplier, payout).catch((err) => console.error("crash bet persist failed", err));
      settlements.push({ userId: bet.userId, username: bet.username, amount: bet.amount, payout, multiplier: finalMultiplier });
    }

    this.history.unshift({ roundId: this.roundId, crashPoint: this.crashPoint, serverSeedHash: this.serverSeedHash });
    this.history = this.history.slice(0, 50);

    this.broadcast("round_crash", {
      roundId: this.roundId,
      crashPoint: this.crashPoint,
      serverSeed: this.serverSeed, // revealed now — anyone can hash it and confirm it matches the pre-shown commitment
      serverSeedHash: this.serverSeedHash,
      settlements,
    });

    setTimeout(() => void this.startBettingPhase(), CRASHED_PAUSE_MS);
  }

  private clearTick() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  private async handlePlaceBet(socket: AuthedSocket, payload: unknown, ack?: (resp: unknown) => void) {
    const reply = (resp: unknown) => ack?.(resp);
    const userId = socket.data.userId;
    if (!userId) return reply({ error: "Authentication required to place bets" });
    if (!socket.data.isApproved) return reply({ error: "Active subscription required to play. Visit patreon.com/GrilledCoin." });
    if (this.phase !== "betting") return reply({ error: "Betting is closed for this round" });
    if (this.bets.has(userId)) return reply({ error: "You already have a bet in this round" });

    const body = payload as { amount?: unknown; autoCashout?: unknown };
    const amount = Number(body?.amount);
    if (!Number.isInteger(amount) || amount <= 0) return reply({ error: "amount must be a positive integer (cents)" });

    let autoCashout: number | undefined;
    if (body?.autoCashout !== undefined && body?.autoCashout !== null) {
      autoCashout = Number(body.autoCashout);
      if (!Number.isFinite(autoCashout) || autoCashout < 1.01) return reply({ error: "autoCashout must be >= 1.01" });
    }

    try {
      const user = await prisma.$transaction(async (tx) => {
        const u = await applyLedgerEntry(tx, userId, "bet", -amount, undefined);
        await tx.user.update({ where: { id: userId }, data: { nonce: { increment: 1 } } });
        return u;
      });

      const bet: RoundBet = {
        userId,
        username: socket.data.username ?? "player",
        amount,
        autoCashout,
        cashedOutAt: null,
        payout: 0,
      };
      this.bets.set(userId, bet);

      reply({ ok: true, balance: user.balance, roundId: this.roundId });
      this.broadcast("bet_placed", { roundId: this.roundId, username: bet.username, amount, autoCashout });
    } catch (err) {
      if (err instanceof InsufficientFundsError) return reply({ error: "Insufficient balance" });
      reply({ error: "Failed to place bet" });
    }
  }

  private async handleCashOut(socket: AuthedSocket, ack?: (resp: unknown) => void) {
    const reply = (resp: unknown) => ack?.(resp);
    const userId = socket.data.userId;
    if (!userId) return reply({ error: "Authentication required" });
    if (this.phase !== "running") return reply({ error: "No round is currently running" });

    const bet = this.bets.get(userId);
    if (!bet) return reply({ error: "You have no active bet this round" });
    if (bet.cashedOutAt !== null) return reply({ error: "Already cashed out" });

    const elapsed = Date.now() - this.roundStartedAt;
    const multiplier = multiplierAtElapsed(elapsed);
    if (multiplier >= this.crashPoint) return reply({ error: "Too late — the round already crashed" });

    await this.lockInCashout(bet, multiplier);
    reply({ ok: true, multiplier, payout: bet.payout });
  }

  /** Credit the payout immediately on cashout (don't wait for round end) and mark the bet settled. */
  private async lockInCashout(bet: RoundBet, multiplier: number) {
    bet.cashedOutAt = multiplier;
    bet.payout = Math.floor(bet.amount * multiplier);

    const updated = await applyLedgerEntry(prisma, bet.userId, "payout", bet.payout, undefined).catch(() => null);
    this.broadcast("cash_out", {
      roundId: this.roundId,
      username: bet.username,
      multiplier,
      payout: bet.payout,
      balance: updated?.balance,
    });
  }

  private async persistBet(bet: RoundBet, multiplier: number, payout: number) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: bet.userId } });

    const gainedXp = xpForWager(bet.amount);
    const newXp = user.xp + gainedXp;
    const newLevel = levelFromXp(newXp);
    if (newLevel > user.level) {
      const levelBonus = newLevel * 500;
      await applyLedgerEntry(prisma, bet.userId, "levelup_bonus", levelBonus, `level_${newLevel}`);
    }
    await prisma.user.update({ where: { id: bet.userId }, data: { xp: newXp, level: newLevel } });

    await prisma.bet.create({
      data: {
        userId: bet.userId,
        game: "crash",
        amount: bet.amount,
        payout,
        multiplier,
        result: payout > bet.amount ? "win" : "loss",
        state: JSON.stringify({ roundId: this.roundId, crashPoint: this.crashPoint, cashedOutAt: bet.cashedOutAt }),
        clientSeed: `crash-round-${this.roundId}`,
        serverSeed: this.serverSeed,
        nonce: this.roundId,
      },
    });
  }

  // -------------------------------------------------------------------------

  private broadcast(event: string, payload: unknown) {
    this.io.of("/crash").to("crash").emit(event, payload);
  }

  private publicState() {
    const base = {
      phase: this.phase,
      roundId: this.roundId,
      serverSeedHash: this.serverSeedHash,
      bets: [...this.bets.values()].map((b) => ({
        username: b.username,
        amount: b.amount,
        autoCashout: b.autoCashout,
        cashedOutAt: b.cashedOutAt,
        payout: b.payout,
      })),
    };

    if (this.phase === "betting") return { ...base, bettingEndsAt: this.phaseEndsAt };
    if (this.phase === "running") {
      return { ...base, startedAt: this.roundStartedAt, multiplier: multiplierAtElapsed(Date.now() - this.roundStartedAt) };
    }
    return { ...base, crashPoint: this.crashPoint };
  }
}
