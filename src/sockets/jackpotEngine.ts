import { isOwner } from "../lib/owner";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry } from "../lib/wallet";
import { checkAndMintNfts } from "../lib/nfts";

interface Entry { userId: string; username: string; amount: number }
interface AuthedSocket extends Socket { data: { userId?: string; username?: string; isApproved?: boolean } }

const SPIN_DELAY_MS = 20_000; // spin 20s after last entry
const MIN_ENTRIES = 1;
const HOUSE_EDGE = 0.05;

export class JackpotEngine {
  private io: Server;
  private entries: Entry[] = [];
  private totalPot = 0;
  private spinTimer: ReturnType<typeof setTimeout> | null = null;
  private spinning = false;
  private history: { winner: string; amount: number; emoji: string }[] = [];

  constructor(io: Server) {
    this.io = io;
    this.attach();
    this.loadOpenRound();
  }

  private async loadOpenRound() {
    const open = await prisma.jackpotRound.findFirst({ where: { status: "open" } });
    if (open) {
      this.entries = JSON.parse(open.entries);
      this.totalPot = open.totalPot;
      if (this.entries.length >= MIN_ENTRIES) this.schedulePin();
    } else {
      await prisma.jackpotRound.create({ data: {} });
    }
    this.broadcast();
  }

  private attach() {
    const ns = this.io.of("/jackpot");

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
      socket.emit("state", this.getState());

      socket.on("enter", async ({ amount }: { amount: number }) => {
        if (!socket.data.userId) return socket.emit("error", "Login required");
        if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
        if (this.spinning) return socket.emit("error", "Round is spinning");
        if (!Number.isInteger(amount) || amount < 100) return socket.emit("error", "Min entry: 1 chip");
        if (amount > 10_000_000) return socket.emit("error", "Max entry: 100,000 chips");

        try {
          await applyLedgerEntry(prisma, socket.data.userId!, "bet", -amount, "jackpot_entry");
          this.entries.push({ userId: socket.data.userId!, username: socket.data.username!, amount });
          this.totalPot += amount;
          await this.persistEntries();
          this.broadcast();
          if (this.entries.length >= MIN_ENTRIES) this.schedulePin();
        } catch (err: any) {
          socket.emit("error", err.message || "Entry failed");
        }
      });
    });
  }

  private schedulePin() {
    if (this.spinTimer) clearTimeout(this.spinTimer);
    this.spinTimer = setTimeout(() => this.spin(), SPIN_DELAY_MS);
    this.io.of("/jackpot").emit("countdown", SPIN_DELAY_MS);
  }

  private async spin() {
    if (this.entries.length < MIN_ENTRIES || this.spinning) return;
    this.spinning = true;
    this.io.of("/jackpot").emit("spinning", true);

    await new Promise((r) => setTimeout(r, 4000));

    const houseCut = Math.floor(this.totalPot * HOUSE_EDGE);
    const prize = this.totalPot - houseCut;

    // Weighted random — pick a float in [0, totalPot) then walk through entries
    const roll = parseFloat("0." + crypto.createHash("sha256").update(Date.now().toString()).digest("hex").slice(0, 10)) * this.totalPot;
    let cursor = 0;
    let winner = this.entries[this.entries.length - 1];
    for (const e of this.entries) {
      cursor += e.amount;
      if (roll < cursor) { winner = e; break; }
    }

    try {
      await applyLedgerEntry(prisma, winner.userId, "payout", prize, "jackpot_win");
      await checkAndMintNfts(winner.userId, { isJackpotWin: true });
    } catch {}

    this.history.unshift({ winner: winner.username, amount: prize, emoji: "🏆" });
    if (this.history.length > 20) this.history.pop();

    this.io.of("/jackpot").emit("result", { winner: winner.username, prize, entries: this.entries, totalPot: this.totalPot });

    await prisma.jackpotRound.updateMany({
      where: { status: "open" },
      data: { status: "closed", winnerId: winner.userId, winnerName: winner.username, closedAt: new Date() },
    });

    this.entries = [];
    this.totalPot = 0;
    this.spinning = false;
    this.spinTimer = null;

    await prisma.jackpotRound.create({ data: {} });
    await new Promise((r) => setTimeout(r, 3000));
    this.broadcast();
  }

  private async persistEntries() {
    await prisma.jackpotRound.updateMany({
      where: { status: "open" },
      data: { entries: JSON.stringify(this.entries), totalPot: this.totalPot },
    });
  }

  private getState() {
    return { entries: this.entries, totalPot: this.totalPot, spinning: this.spinning, history: this.history };
  }

  private broadcast() {
    this.io.of("/jackpot").emit("state", this.getState());
  }
}
