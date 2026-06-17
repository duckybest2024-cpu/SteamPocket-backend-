import { isOwner } from "../lib/owner";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry, InsufficientFundsError } from "../lib/wallet";

const PAYOUT_MULTIPLIER = 1.98; // 2% total house edge (1% per side)
const MAX_OPEN_CHALLENGES = 50;

interface CoinflipChallenge {
  id: string;
  creatorId: string;
  creatorName: string;
  amount: number; // cents
  serverSeed: string;
  serverSeedHash: string;
  createdAt: number;
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
    if (!socket.data.isApproved) return reply({ error: "Active subscription required. Visit patreon.com/GrilledCoin." });

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
  }

  private async handleCancelChallenge(
    socket: AuthedSocket,
    payload: unknown,
    ack?: (resp: unknown) => void
  ) {
    const reply = (resp: unknown) => ack?.(resp);
    const userId = socket.data.userId;
    if (!userId) return reply({ error: "Authentication required" });
    if (!socket.data.isApproved) return reply({ error: "Active subscription required. Visit patreon.com/GrilledCoin." });

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
    if (!socket.data.isApproved) return reply({ error: "Active subscription required. Visit patreon.com/GrilledCoin." });

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

    // Determine winner: SHA256(serverSeed + joinerId), first nibble < 8 → creator wins
    const resultHash = crypto.createHash("sha256").update(challenge.serverSeed + userId).digest("hex");
    const creatorWins = parseInt(resultHash[0], 16) < 8;

    const winnerId = creatorWins ? challenge.creatorId : userId;
    const winnerName = creatorWins ? challenge.creatorName : joinerName;
    const loserName = creatorWins ? joinerName : challenge.creatorName;
    const payout = Math.floor(challenge.amount * PAYOUT_MULTIPLIER);

    await applyLedgerEntry(prisma, winnerId, "coinflip_payout", payout, id).catch((err) => {
      console.error("Coinflip payout failed:", err);
    });

    await Promise.all([
      prisma.bet
        .create({
          data: {
            userId: challenge.creatorId,
            game: "coinflip",
            amount: challenge.amount,
            payout: creatorWins ? payout : 0,
            multiplier: creatorWins ? PAYOUT_MULTIPLIER : 0,
            result: creatorWins ? "win" : "loss",
            state: JSON.stringify({ challengeId: id, resultHash, opponent: joinerName }),
            clientSeed: userId,
            serverSeed: challenge.serverSeed,
            nonce: 0,
          },
        })
        .catch(() => {}),
      prisma.bet
        .create({
          data: {
            userId,
            game: "coinflip",
            amount: challenge.amount,
            payout: !creatorWins ? payout : 0,
            multiplier: !creatorWins ? PAYOUT_MULTIPLIER : 0,
            result: !creatorWins ? "win" : "loss",
            state: JSON.stringify({ challengeId: id, resultHash, opponent: challenge.creatorName }),
            clientSeed: userId,
            serverSeed: challenge.serverSeed,
            nonce: 0,
          },
        })
        .catch(() => {}),
    ]);

    const result = {
      id,
      creatorName: challenge.creatorName,
      joinerName,
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
      joinerName,
      winnerName,
      amount: challenge.amount,
      serverSeedHash: challenge.serverSeedHash,
      createdAt: challenge.createdAt,
    });
    this.recentResults = this.recentResults.slice(0, 20);

    reply({ ok: true, ...result });
    this.broadcast("challenge_result", result);
  }
}
