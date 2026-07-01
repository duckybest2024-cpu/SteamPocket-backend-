import { isOwner } from "../lib/owner";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry, InsufficientFundsError } from "../lib/wallet";
import { makeBot, botStakeCents, randInt, isBotId, botDelay } from "./botFiller";

const PAYOUT_MULTIPLIER = 1.98; // 2% total house edge (1% per side)
const MAX_OPEN_CHALLENGES = 50;
const TARGET_BOT_CHALLENGES = 3; // open bot challenges to keep in the lobby

interface CoinflipChallenge {
  id: string;
  creatorId: string;
  creatorName: string;
  amount: number; // cents
  serverSeed: string;
  serverSeedHash: string;
  createdAt: number;
  isBot?: boolean; // creator is a synthetic filler player
}

interface RecentResult {
  id: string;
  creatorName: string;
  joinerName: string;
  winnerName: string;
  amount: number;
  serverSeedHash: string;
  createdAt: number;
}

interface AuthedSocket extends Socket {
  data: { userId?: string; username?: string; isApproved?: boolean };
}

export class CoinflipEngine {
  private io: Server;
  private challenges = new Map<string, CoinflipChallenge>();
  private recentResults: RecentResult[] = [];

  constructor(io: Server) {
    this.io = io;
    this.attach();
    this.ensureBotChallenges();
    // Keep the lobby stocked, and occasionally rotate a stale bot challenge so
    // the listed amounts keep changing like a real lobby would.
    setInterval(() => {
      const botChallenges = [...this.challenges.values()].filter((c) => c.isBot);
      if (botChallenges.length > 0 && Math.random() < 0.5) {
        const stale = botChallenges[randInt(0, botChallenges.length - 1)];
        this.challenges.delete(stale.id);
        this.broadcast("challenge_cancelled", { id: stale.id });
      }
      this.ensureBotChallenges();
    }, 45_000);
  }

  private attach() {
    const namespace = this.io.of("/coinflip");

    namespace.use(async (socket: AuthedSocket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        try {
          const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, username: true, isApproved: true, approvedUntil: true, isAdmin: true },
          });
          if (user) {
            socket.data.userId = user.id;
            socket.data.username = user.username;
            socket.data.isApproved = isOwner(user.username) || !!user.isAdmin || (user.isApproved && (!user.approvedUntil || user.approvedUntil > new Date()));
          }
        } catch {
          // Anonymous spectator — can watch but not play
        }
      }
      next();
    });

    namespace.on("connection", (socket: AuthedSocket) => {
      socket.join("coinflip");
      socket.emit("state", this.publicState());

      socket.on("create_challenge", (payload, ack) => void this.handleCreateChallenge(socket, payload, ack));
      socket.on("cancel_challenge", (payload, ack) => void this.handleCancelChallenge(socket, payload, ack));
      socket.on("join_challenge", (payload, ack) => void this.handleJoinChallenge(socket, payload, ack));
    });
  }

  private publicState() {
    return {
      challenges: [...this.challenges.values()].map((c) => ({
        id: c.id,
        creatorName: c.creatorName,
        amount: c.amount,
        serverSeedHash: c.serverSeedHash,
        createdAt: c.createdAt,
      })),
      recentResults: this.recentResults.slice(0, 15),
    };
  }

  private broadcast(event: string, payload: unknown) {
    this.io.of("/coinflip").to("coinflip").emit(event, payload);
  }

  private async handleCreateChallenge(
    socket: AuthedSocket,
    payload: unknown,
    ack?: (resp: unknown) => void
  ) {
    const reply = (resp: unknown) => ack?.(resp);
    const userId = socket.data.userId;
    if (!userId) return reply({ error: "Authentication required" });
    if (!socket.data.isApproved) return reply({ error: "Active subscription required." });

    // Prevent duplicate open challenges from same user
    for (const c of this.challenges.values()) {
      if (c.creatorId === userId) return reply({ error: "You already have an open challenge — cancel it first" });
    }
    if (this.challenges.size >= MAX_OPEN_CHALLENGES) {
      return reply({ error: "Too many open challenges — wait for one to be taken" });
    }

    const body = payload as { amount?: unknown };
    const amount = Number(body?.amount); // cents
    if (!Number.isInteger(amount) || amount < 100) {
      return reply({ error: "Minimum bet is 1 chip (100 cents)" });
    }

    try {
      await applyLedgerEntry(prisma, userId, "coinflip_bet", -amount, undefined);
    } catch (err) {
      if (err instanceof InsufficientFundsError) return reply({ error: "Insufficient balance" });
      return reply({ error: "Failed to place bet" });
    }

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = crypto.createHash("sha256").update(serverSeed).digest("hex");
    const id = crypto.randomBytes(8).toString("hex");

    const challenge: CoinflipChallenge = {
      id,
      creatorId: userId,
      creatorName: socket.data.username ?? "player",
      amount,
      serverSeed,
      serverSeedHash,
      createdAt: Date.now(),
    };
    this.challenges.set(id, challenge);

    reply({ ok: true, challengeId: id, serverSeedHash });
    this.broadcast("challenge_created", {
      id,
      creatorName: challenge.creatorName,
      amount,
      serverSeedHash,
      createdAt: challenge.createdAt,
    });

    // If no real player grabs it, a bot will — so a lone player isn't stuck waiting.
    this.scheduleBotTakeover(id);
  }

  private async handleCancelChallenge(
    socket: AuthedSocket,
    payload: unknown,
    ack?: (resp: unknown) => void
  ) {
    const reply = (resp: unknown) => ack?.(resp);
    const userId = socket.data.userId;
    if (!userId) return reply({ error: "Authentication required" });
    if (!socket.data.isApproved) return reply({ error: "Active subscription required." });

    const body = payload as { challengeId?: unknown };
    const id = String(body?.challengeId ?? "");
    const challenge = this.challenges.get(id);
    if (!challenge) return reply({ error: "Challenge not found" });
    if (challenge.creatorId !== userId) return reply({ error: "Not your challenge" });

    this.challenges.delete(id);

    await applyLedgerEntry(prisma, userId, "coinflip_refund", challenge.amount, id).catch((err) => {
      console.error("Coinflip refund failed:", err);
    });

    reply({ ok: true });
    this.broadcast("challenge_cancelled", { id });
  }

  private async handleJoinChallenge(
    socket: AuthedSocket,
    payload: unknown,
    ack?: (resp: unknown) => void
  ) {
    const reply = (resp: unknown) => ack?.(resp);
    const userId = socket.data.userId;
    if (!userId) return reply({ error: "Authentication required" });
    if (!socket.data.isApproved) return reply({ error: "Active subscription required." });

    const body = payload as { challengeId?: unknown };
    const id = String(body?.challengeId ?? "");
    const challenge = this.challenges.get(id);
    if (!challenge) return reply({ error: "Challenge not found or already taken" });
    if (challenge.creatorId === userId) return reply({ error: "You cannot join your own challenge" });

    // Claim the slot immediately to prevent races
    this.challenges.delete(id);

    try {
      await applyLedgerEntry(prisma, userId, "coinflip_bet", -challenge.amount, id);
    } catch (err) {
      // Restore the challenge so someone else can take it
      this.challenges.set(id, challenge);
      if (err instanceof InsufficientFundsError) return reply({ error: "Insufficient balance" });
      return reply({ error: "Failed to place bet" });
    }

    const joinerName = socket.data.username ?? "player";
    const result = await this.settleChallenge(challenge, { userId, username: joinerName, isBot: false });
    reply({ ok: true, ...result });
    // A bot challenge that just got taken should be replaced so the lobby stays full.
    if (challenge.isBot) this.ensureBotChallenges();
  }

  /**
   * Resolve a claimed challenge against a joiner (human or bot) and broadcast
   * the outcome. The caller is responsible for having already deducted the
   * joiner's stake (humans only — bots never pay). The winner is paid only if
   * it is a real user; bot winners are kept by the house. Bet-history rows are
   * written only for the human participant(s).
   */
  private async settleChallenge(
    challenge: CoinflipChallenge,
    joiner: { userId: string; username: string; isBot: boolean }
  ) {
    const id = challenge.id;

    // Determine winner: SHA256(serverSeed + joinerId), first nibble < 8 → creator wins
    const resultHash = crypto.createHash("sha256").update(challenge.serverSeed + joiner.userId).digest("hex");
    const creatorWins = parseInt(resultHash[0], 16) < 8;

    const winnerId = creatorWins ? challenge.creatorId : joiner.userId;
    const winnerName = creatorWins ? challenge.creatorName : joiner.username;
    const loserName = creatorWins ? joiner.username : challenge.creatorName;
    const payout = Math.floor(challenge.amount * PAYOUT_MULTIPLIER);

    if (!isBotId(winnerId)) {
      await applyLedgerEntry(prisma, winnerId, "coinflip_payout", payout, id).catch((err) => {
        console.error("Coinflip payout failed:", err);
      });
    }

    const writes: Promise<unknown>[] = [];
    if (!challenge.isBot) {
      writes.push(prisma.bet.create({
        data: {
          userId: challenge.creatorId,
          game: "coinflip",
          amount: challenge.amount,
          payout: creatorWins ? payout : 0,
          multiplier: creatorWins ? PAYOUT_MULTIPLIER : 0,
          result: creatorWins ? "win" : "loss",
          state: JSON.stringify({ challengeId: id, resultHash, opponent: joiner.username }),
          clientSeed: joiner.userId,
          serverSeed: challenge.serverSeed,
          nonce: 0,
        },
      }).catch(() => {}));
    }
    if (!joiner.isBot) {
      writes.push(prisma.bet.create({
        data: {
          userId: joiner.userId,
          game: "coinflip",
          amount: challenge.amount,
          payout: !creatorWins ? payout : 0,
          multiplier: !creatorWins ? PAYOUT_MULTIPLIER : 0,
          result: !creatorWins ? "win" : "loss",
          state: JSON.stringify({ challengeId: id, resultHash, opponent: challenge.creatorName }),
          clientSeed: joiner.userId,
          serverSeed: challenge.serverSeed,
          nonce: 0,
        },
      }).catch(() => {}));
    }
    await Promise.all(writes);

    const result = {
      id,
      creatorName: challenge.creatorName,
      joinerName: joiner.username,
      winnerName,
      loserName,
      amount: challenge.amount,
      payout,
      serverSeed: challenge.serverSeed,
      serverSeedHash: challenge.serverSeedHash,
      resultHash,
      creatorWins,
    };

    this.recentResults.unshift({
      id,
      creatorName: challenge.creatorName,
      joinerName: joiner.username,
      winnerName,
      amount: challenge.amount,
      serverSeedHash: challenge.serverSeedHash,
      createdAt: challenge.createdAt,
    });
    this.recentResults = this.recentResults.slice(0, 20);

    this.broadcast("challenge_result", result);
    return result;
  }

  // ─── Synthetic filler players ───────────────────────────────────────────────

  /** A human just posted a challenge — have a bot take it if no real player does. */
  private scheduleBotTakeover(challengeId: string) {
    void (async () => {
      await botDelay(5_000, 16_000);
      const challenge = this.challenges.get(challengeId);
      if (!challenge || challenge.isBot) return; // already taken, cancelled, or a bot's own
      this.challenges.delete(challengeId);
      const bot = makeBot();
      await this.settleChallenge(challenge, { userId: bot.id, username: bot.username, isBot: true });
    })();
  }

  /** Keep a handful of open bot challenges in the lobby for humans to join. */
  private ensureBotChallenges() {
    const openBots = [...this.challenges.values()].filter((c) => c.isBot).length;
    for (let i = openBots; i < TARGET_BOT_CHALLENGES; i++) {
      const bot = makeBot();
      const id = crypto.randomBytes(8).toString("hex");
      const serverSeed = crypto.randomBytes(32).toString("hex");
      const serverSeedHash = crypto.createHash("sha256").update(serverSeed).digest("hex");
      const challenge: CoinflipChallenge = {
        id,
        creatorId: bot.id,
        creatorName: bot.username,
        amount: botStakeCents(1, 250),
        serverSeed,
        serverSeedHash,
        createdAt: Date.now(),
        isBot: true,
      };
      this.challenges.set(id, challenge);
      this.broadcast("challenge_created", {
        id,
        creatorName: challenge.creatorName,
        amount: challenge.amount,
        serverSeedHash,
        createdAt: challenge.createdAt,
      });
    }
  }
}
