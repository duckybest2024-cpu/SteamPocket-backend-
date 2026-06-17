import { isOwner } from "../lib/owner";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry } from "../lib/wallet";

interface AuthedSocket extends Socket { data: { userId?: string; username?: string; isApproved?: boolean } }

const HORSES = [
  { id: 0, name: "Lightning", emoji: "⚡", color: "#f59e0b", odds: 2.0 },
  { id: 1, name: "Thunder",   emoji: "⛈️", color: "#6366f1", odds: 3.0 },
  { id: 2, name: "Phoenix",   emoji: "🦅", color: "#ef4444", odds: 4.0 },
  { id: 3, name: "Shadow",    emoji: "🌑", color: "#374151", odds: 5.0 },
  { id: 4, name: "Blaze",     emoji: "🔥", color: "#f97316", odds: 7.0 },
  { id: 5, name: "Lucky",     emoji: "🍀", color: "#10b981", odds: 10.0 },
];

const BETTING_MS = 15_000;
const RACE_MS = 10_000;
const REST_MS = 5_000;

type Phase = "betting" | "racing" | "results";

export class HorseRaceEngine {
  private io: Server;
  private phase: Phase = "betting";
  private phaseEndsAt = Date.now() + BETTING_MS;
  private bets = new Map<string, { userId: string; username: string; horseId: number; amount: number }>();
  private winnerHorse = 0;
  private positions = HORSES.map(() => 0);
  private raceInterval: ReturnType<typeof setInterval> | null = null;
  private history: { winner: string; emoji: string; roundMs: number }[] = [];

  constructor(io: Server) {
    this.io = io;
    this.attach();
    this.startBetting();
  }

  private attach() {
    const ns = this.io.of("/horserace");

    ns.use(async (socket: AuthedSocket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        try {
          const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
          const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true, isApproved: true, approvedUntil: true, isAdmin: true } });
          if (user) { socket.data.userId = user.id; socket.data.username = user.username; socket.data.isApproved = isOwner(user.username) || !!user.isAdmin || (user.isApproved && (!user.approvedUntil || user.approvedUntil > new Date())); }
        } catch {}
      }
      next();
    });

    ns.on("connection", (socket: AuthedSocket) => {
      socket.emit("horses", HORSES);
      socket.emit("phase", { phase: this.phase, endsAt: this.phaseEndsAt, positions: this.positions, history: this.history });

      socket.on("bet", async ({ horseId, amount }: { horseId: number; amount: number }) => {
        if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
        if (this.phase !== "betting") return socket.emit("error", "Betting is closed");
        if (horseId < 0 || horseId >= HORSES.length) return socket.emit("error", "Invalid horse");
        if (!Number.isInteger(amount) || amount < 100) return socket.emit("error", "Min bet: 1 chip");

        const existing = this.bets.get(socket.data.userId!);
        if (existing) return socket.emit("error", "Already bet this round");

        try {
          await applyLedgerEntry(prisma, socket.data.userId!, "bet", -amount, "horse_bet");
          this.bets.set(socket.data.userId!, { userId: socket.data.userId!, username: socket.data.username!, horseId, amount });
          this.io.of("/horserace").emit("bets_update", Array.from(this.bets.values()));
          socket.emit("bet_ok", { horseId, amount });
        } catch (err: any) {
          socket.emit("error", err.message || "Bet failed");
        }
      });
    });
  }

  private startBetting() {
    this.phase = "betting";
    this.phaseEndsAt = Date.now() + BETTING_MS;
    this.bets.clear();
    this.positions = HORSES.map(() => 0);
    this.io.of("/horserace").emit("phase", { phase: "betting", endsAt: this.phaseEndsAt, positions: this.positions, history: this.history });
    setTimeout(() => this.startRace(), BETTING_MS);
  }

  private startRace() {
    this.phase = "racing";
    const seed = crypto.randomBytes(16).toString("hex");
    // Determine winner using seeded randomness — lower odds horses win more often
    const weights = HORSES.map((h) => 1 / h.odds);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = parseFloat("0." + crypto.createHash("sha256").update(seed).digest("hex").slice(0, 10)) * total;
    let winner = 0;
    for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) { winner = i; break; } }
    this.winnerHorse = winner;

    // Simulate positions over RACE_MS
    const startAt = Date.now();
    this.phaseEndsAt = startAt + RACE_MS;
    this.io.of("/horserace").emit("phase", { phase: "racing", endsAt: this.phaseEndsAt, winnerHorse: null, positions: this.positions });

    this.raceInterval = setInterval(() => {
      const elapsed = Date.now() - startAt;
      const progress = Math.min(elapsed / RACE_MS, 1);

      for (let i = 0; i < HORSES.length; i++) {
        const isWinner = i === winner;
        // Winner always reaches 100 at end; others lag behind weighted randomly
        const targetFinal = isWinner ? 100 : 60 + Math.random() * 35;
        this.positions[i] = Math.min(100, targetFinal * this.easeOut(progress) + Math.random() * 2);
      }

      this.io.of("/horserace").emit("positions", this.positions);

      if (progress >= 1) {
        clearInterval(this.raceInterval!);
        this.positions[winner] = 100;
        this.io.of("/horserace").emit("positions", this.positions);
        this.endRace(winner);
      }
    }, 100);
  }

  private async endRace(winnerId: number) {
    this.phase = "results";
    const horse = HORSES[winnerId];
    this.io.of("/horserace").emit("phase", { phase: "results", winnerHorse: winnerId, endsAt: Date.now() + REST_MS, positions: this.positions });

    for (const bet of this.bets.values()) {
      if (bet.horseId === winnerId) {
        const payout = Math.floor(bet.amount * horse.odds);
        try {
          await applyLedgerEntry(prisma, bet.userId, "payout", payout, "horse_win");
        } catch {}
      }
    }

    this.history.unshift({ winner: horse.name, emoji: horse.emoji, roundMs: RACE_MS });
    if (this.history.length > 20) this.history.pop();

    setTimeout(() => this.startBetting(), REST_MS);
  }

  private easeOut(t: number) { return 1 - Math.pow(1 - t, 2); }
}
