import { isOwner } from "../lib/owner";
/**
 * Battle Dice, Rock Paper Scissors, Raffle, Bingo — all in one file for simplicity.
 * Each game gets its own Socket.IO namespace.
 */
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry } from "../lib/wallet";

interface AuthedSocket extends Socket { data: { userId?: string; username?: string; isApproved?: boolean } }

function authMiddleware(io: Server, ns: string) {
  return io.of(ns).use(async (socket: AuthedSocket, next) => {
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
}

// ─────────────────────────────────────────
// BATTLE DICE: up to 8 players, all roll, highest wins pot
// ─────────────────────────────────────────
export function attachBattleDice(io: Server) {
  authMiddleware(io, "/battledice");
  const ns = io.of("/battledice");

  // Rooms: up to 8 players each, 30s betting, then roll
  const rooms = new Map<string, {
    bets: Map<string, { username: string; amount: number }>;
    phase: "betting" | "rolling" | "results";
    endsAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    rolls: { username: string; roll: number; amount: number }[];
  }>();

  function getOrCreateRoom(id: string) {
    if (!rooms.has(id)) {
      rooms.set(id, { bets: new Map(), phase: "betting", endsAt: Date.now() + 30_000, timer: null, rolls: [] });
    }
    return rooms.get(id)!;
  }

  async function rollRoom(roomId: string) {
    const room = rooms.get(roomId);
    if (!room || room.bets.size === 0) { rooms.delete(roomId); return; }
    room.phase = "rolling";
    ns.to(roomId).emit("rolling");

    await new Promise((r) => setTimeout(r, 2000));

    const rolls: { userId: string; username: string; roll: number; amount: number }[] = [];
    for (const [userId, bet] of room.bets.entries()) {
      const roll = 1 + Math.floor(parseFloat("0." + crypto.createHash("sha256").update(userId + Date.now()).digest("hex").slice(0, 10)) * 6);
      rolls.push({ userId, username: bet.username, roll, amount: bet.amount });
    }

    rolls.sort((a, b) => b.roll - a.roll);
    const highestRoll = rolls[0].roll;
    const winners = rolls.filter((r) => r.roll === highestRoll);
    const totalPot = rolls.reduce((s, r) => s + r.amount, 0);
    const houseCut = Math.floor(totalPot * 0.05);
    const prize = Math.floor((totalPot - houseCut) / winners.length);

    for (const w of winners) {
      try { await applyLedgerEntry(prisma, w.userId, "payout", prize, "battledice_win"); } catch {}
    }

    room.phase = "results";
    room.rolls = rolls;
    ns.to(roomId).emit("results", { rolls, winners: winners.map((w) => w.username), prize, totalPot });

    await new Promise((r) => setTimeout(r, 5000));
    rooms.delete(roomId);
    ns.to(roomId).emit("room_closed");
  }

  ns.on("connection", (socket: AuthedSocket) => {
    let currentRoom = "";

    socket.on("join_room", ({ roomId, amount }: { roomId: string; amount: number }) => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (!Number.isInteger(amount) || amount < 100) return socket.emit("error", "Min bet: 1 chip");

      const room = getOrCreateRoom(roomId);
      if (room.phase !== "betting") return socket.emit("error", "Room already rolling");
      if (room.bets.size >= 8) return socket.emit("error", "Room is full (8 players max)");
      if (room.bets.has(socket.data.userId!)) return socket.emit("error", "Already in this room");

      applyLedgerEntry(prisma, socket.data.userId!, "bet", -amount, "battledice_bet").then(() => {
        room.bets.set(socket.data.userId!, { username: socket.data.username!, amount });
        socket.join(roomId);
        currentRoom = roomId;
        ns.to(roomId).emit("room_state", { bets: Object.fromEntries(room.bets), endsAt: room.endsAt, phase: room.phase });

        if (room.timer) clearTimeout(room.timer);
        room.endsAt = Date.now() + 30_000;
        room.timer = setTimeout(() => rollRoom(roomId), 30_000);
        ns.to(roomId).emit("timer_reset", room.endsAt);
      }).catch((err: any) => socket.emit("error", err.message || "Bet failed"));
    });

    socket.on("disconnect", () => {
      if (currentRoom) socket.leave(currentRoom);
    });
  });
}

// ─────────────────────────────────────────
// ROCK PAPER SCISSORS — 1v1 matchmaking queue
// ─────────────────────────────────────────
export function attachRPS(io: Server) {
  authMiddleware(io, "/rps");
  const ns = io.of("/rps");

  type Choice = "rock" | "paper" | "scissors";
  interface Waiting { socketId: string; userId: string; username: string; amount: number }
  interface Match {
    p1: { socketId: string; userId: string; username: string; amount: number; choice?: Choice };
    p2: { socketId: string; userId: string; username: string; amount: number; choice?: Choice };
  }

  const queue: Waiting[] = [];
  const matches = new Map<string, Match>(); // matchId -> match
  const playerMatch = new Map<string, string>(); // userId -> matchId

  function resolve(c1: Choice, c2: Choice): number {
    if (c1 === c2) return 0;
    if ((c1 === "rock" && c2 === "scissors") || (c1 === "scissors" && c2 === "paper") || (c1 === "paper" && c2 === "rock")) return 1;
    return 2;
  }

  ns.on("connection", (socket: AuthedSocket) => {
    socket.on("queue", async ({ amount }: { amount: number }) => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (!Number.isInteger(amount) || amount < 100) return socket.emit("error", "Min bet: 1 chip");
      if (playerMatch.has(socket.data.userId!)) return socket.emit("error", "Already in a match");

      try {
        await applyLedgerEntry(prisma, socket.data.userId!, "bet", -amount, "rps_bet");
      } catch (err: any) {
        return socket.emit("error", err.message || "Bet failed");
      }

      // Find opponent with same amount
      const opponentIdx = queue.findIndex((w) => w.amount === amount && w.userId !== socket.data.userId!);
      if (opponentIdx !== -1) {
        const opp = queue.splice(opponentIdx, 1)[0];
        const matchId = crypto.randomUUID();
        const match: Match = {
          p1: { socketId: opp.socketId, userId: opp.userId, username: opp.username, amount },
          p2: { socketId: socket.id, userId: socket.data.userId!, username: socket.data.username!, amount },
        };
        matches.set(matchId, match);
        playerMatch.set(opp.userId, matchId);
        playerMatch.set(socket.data.userId!, matchId);

        ns.to(opp.socketId).emit("match_found", { matchId, opponent: socket.data.username!, amount });
        socket.emit("match_found", { matchId, opponent: opp.username, amount });
      } else {
        queue.push({ socketId: socket.id, userId: socket.data.userId!, username: socket.data.username!, amount });
        socket.emit("queued", { amount });
      }
    });

    socket.on("choose", async ({ matchId, choice }: { matchId: string; choice: Choice }) => {
      if (!socket.data.userId) return;
      if (!["rock", "paper", "scissors"].includes(choice)) return;
      const match = matches.get(matchId);
      if (!match) return socket.emit("error", "Match not found");

      const isP1 = match.p1.userId === socket.data.userId!;
      if (isP1) match.p1.choice = choice; else match.p2.choice = choice;

      socket.emit("choice_recorded");

      if (match.p1.choice && match.p2.choice) {
        const result = resolve(match.p1.choice, match.p2.choice);
        const totalPot = match.p1.amount + match.p2.amount;
        const prize = Math.floor(totalPot * 0.95);

        let winnerId: string | null = null;
        let winnerName: string | null = null;
        if (result === 1) { winnerId = match.p1.userId; winnerName = match.p1.username; }
        else if (result === 2) { winnerId = match.p2.userId; winnerName = match.p2.username; }
        else {
          // Tie — refund both
          try { await applyLedgerEntry(prisma, match.p1.userId, "payout", match.p1.amount, "rps_tie"); } catch {}
          try { await applyLedgerEntry(prisma, match.p2.userId, "payout", match.p2.amount, "rps_tie"); } catch {}
        }

        if (winnerId) {
          try { await applyLedgerEntry(prisma, winnerId, "payout", prize, "rps_win"); } catch {}
        }

        const payload = { p1: { username: match.p1.username, choice: match.p1.choice }, p2: { username: match.p2.username, choice: match.p2.choice }, winner: winnerName, prize };
        ns.to(match.p1.socketId).emit("result", payload);
        ns.to(match.p2.socketId).emit("result", payload);

        playerMatch.delete(match.p1.userId);
        playerMatch.delete(match.p2.userId);
        matches.delete(matchId);
      }
    });

    socket.on("dequeue", async () => {
      const idx = queue.findIndex((w) => w.userId === socket.data.userId);
      if (idx !== -1) {
        const w = queue.splice(idx, 1)[0];
        try { await applyLedgerEntry(prisma, w.userId, "deposit", w.amount, "rps_refund"); } catch {}
        socket.emit("dequeued");
      }
    });

    socket.on("disconnect", async () => {
      const idx = queue.findIndex((w) => w.userId === socket.data.userId);
      if (idx !== -1) {
        const w = queue.splice(idx, 1)[0];
        try { await applyLedgerEntry(prisma, w.userId, "deposit", w.amount, "rps_refund"); } catch {}
      }
    });
  });
}

// ─────────────────────────────────────────
// RAFFLE — buy tickets, winner drawn every 5 minutes
// ─────────────────────────────────────────
export function attachRaffle(io: Server) {
  authMiddleware(io, "/raffle");
  const ns = io.of("/raffle");

  const TICKET_PRICE = 1000; // 10 chips per ticket
  const DRAW_INTERVAL_MS = 5 * 60 * 1000;

  let tickets: { userId: string; username: string; ticketNum: number }[] = [];
  let nextTicket = 1;
  let nextDrawAt = Date.now() + DRAW_INTERVAL_MS;
  let history: { winner: string; prize: number; tickets: number }[] = [];

  function scheduleNextDraw() {
    nextDrawAt = Date.now() + DRAW_INTERVAL_MS;
    setTimeout(draw, DRAW_INTERVAL_MS);
  }

  async function draw() {
    if (tickets.length === 0) { scheduleNextDraw(); return; }

    const totalPot = tickets.length * TICKET_PRICE;
    const prize = Math.floor(totalPot * 0.95);
    const winIdx = Math.floor(Math.random() * tickets.length);
    const winner = tickets[winIdx];

    try { await applyLedgerEntry(prisma, winner.userId, "payout", prize, "raffle_win"); } catch {}
    history.unshift({ winner: winner.username, prize, tickets: tickets.length });
    if (history.length > 20) history.pop();

    ns.emit("draw_result", { winner: winner.username, winnerTicket: winner.ticketNum, prize, totalTickets: tickets.length });

    tickets = [];
    nextTicket = 1;
    scheduleNextDraw();
    ns.emit("state", getState());
  }

  function getState() {
    return { tickets: tickets.length, nextDrawAt, ticketPrice: TICKET_PRICE, history };
  }

  scheduleNextDraw();

  ns.on("connection", (socket: AuthedSocket) => {
    socket.emit("state", getState());

    socket.on("buy_tickets", async ({ count }: { count: number }) => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (!Number.isInteger(count) || count < 1 || count > 100) return socket.emit("error", "Buy 1-100 tickets at once");

      const total = TICKET_PRICE * count;
      try {
        await applyLedgerEntry(prisma, socket.data.userId!, "bet", -total, "raffle_tickets");
        for (let i = 0; i < count; i++) {
          tickets.push({ userId: socket.data.userId!, username: socket.data.username!, ticketNum: nextTicket++ });
        }
        socket.emit("tickets_ok", { count, total, ticketNums: tickets.slice(-count).map((t) => t.ticketNum) });
        ns.emit("state", getState());
      } catch (err: any) {
        socket.emit("error", err.message || "Purchase failed");
      }
    });
  });
}

// ─────────────────────────────────────────
// BINGO — 5x5 cards, shared draws, first to complete a line wins
// ─────────────────────────────────────────
export function attachBingo(io: Server) {
  authMiddleware(io, "/bingo");
  const ns = io.of("/bingo");

  const BUY_IN = 5000; // 50 chips
  const DRAW_INTERVAL_MS = 3000;

  let players = new Map<string, { username: string; card: number[][]; marks: boolean[][]; amount: number }>();
  let drawn: number[] = [];
  let bag = Array.from({ length: 75 }, (_, i) => i + 1);
  let phase: "waiting" | "playing" | "ended" = "waiting";
  let drawTimer: ReturnType<typeof setInterval> | null = null;
  let waitTimer: ReturnType<typeof setTimeout> | null = null;

  function makeCard(): number[][] {
    const cols: number[][] = [
      shuffle(range(1, 15)).slice(0, 5),
      shuffle(range(16, 30)).slice(0, 5),
      shuffle(range(31, 45)).slice(0, 5),
      shuffle(range(46, 60)).slice(0, 5),
      shuffle(range(61, 75)).slice(0, 5),
    ];
    // Transpose cols to rows
    return Array.from({ length: 5 }, (_, r) => cols.map((c) => c[r]));
  }

  function range(a: number, b: number) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
  function shuffle<T>(arr: T[]): T[] { return arr.sort(() => Math.random() - 0.5); }

  function checkBingo(card: number[][], marks: boolean[][]): boolean {
    // Check rows
    for (let r = 0; r < 5; r++) if (marks[r].every(Boolean)) return true;
    // Check cols
    for (let c = 0; c < 5; c++) if (marks.map((row) => row[c]).every(Boolean)) return true;
    // Check diagonals
    if ([0,1,2,3,4].every((i) => marks[i][i])) return true;
    if ([0,1,2,3,4].every((i) => marks[i][4-i])) return true;
    return false;
  }

  function updateMarks(card: number[][], marks: boolean[][], num: number) {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (card[r][c] === num) marks[r][c] = true;
    }
  }

  function startGame() {
    phase = "playing";
    drawn = [];
    bag = shuffle(range(1, 75));
    ns.emit("game_start", { players: players.size });

    drawTimer = setInterval(async () => {
      if (bag.length === 0 || phase !== "playing") { clearInterval(drawTimer!); return; }
      const num = bag.pop()!;
      drawn.push(num);

      const winners: string[] = [];
      for (const [userId, p] of players.entries()) {
        updateMarks(p.card, p.marks, num);
        if (checkBingo(p.card, p.marks)) winners.push(userId);
      }

      ns.emit("number_drawn", { num, drawn });

      if (winners.length > 0) {
        clearInterval(drawTimer!);
        phase = "ended";
        const totalPot = players.size * BUY_IN;
        const prize = Math.floor((totalPot * 0.95) / winners.length);
        const winnerNames: string[] = [];
        for (const wId of winners) {
          try { await applyLedgerEntry(prisma, wId, "payout", prize, "bingo_win"); } catch {}
          winnerNames.push(players.get(wId)?.username ?? "");
        }
        ns.emit("bingo", { winners: winnerNames, prize });
        players.clear();
        setTimeout(() => { phase = "waiting"; ns.emit("waiting", {}); }, 8000);
      }
    }, DRAW_INTERVAL_MS);
  }

  ns.on("connection", (socket: AuthedSocket) => {
    socket.emit("state", { phase, players: players.size, drawn });

    socket.on("join", async () => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (phase !== "waiting") return socket.emit("error", "Game in progress, wait for next round");
      if (players.has(socket.data.userId!)) return socket.emit("error", "Already joined");
      if (players.size >= 20) return socket.emit("error", "Room full (20 players max)");

      try {
        await applyLedgerEntry(prisma, socket.data.userId!, "bet", -BUY_IN, "bingo_entry");
        const card = makeCard();
        const marks = Array.from({ length: 5 }, () => Array(5).fill(false));
        players.set(socket.data.userId!, { username: socket.data.username!, card, marks, amount: BUY_IN });
        socket.emit("card", { card });
        ns.emit("player_joined", { players: players.size, username: socket.data.username });

        // Start game when we have 2+ players, after 10s wait
        if (players.size === 2 && phase === "waiting") {
          if (waitTimer) clearTimeout(waitTimer);
          waitTimer = setTimeout(() => { if (players.size >= 2) startGame(); }, 10_000);
          ns.emit("starting_soon", { inMs: 10_000, players: players.size });
        }
      } catch (err: any) {
        socket.emit("error", err.message || "Failed to join");
      }
    });
  });
}

// ─────────────────────────────────────────
// TOWER — predict ever-increasing multipliers, stop when you want
// ─────────────────────────────────────────
export function attachTower(io: Server) {
  authMiddleware(io, "/tower");
  const ns = io.of("/tower");

  // Each player has their own independent tower session
  const sessions = new Map<string, { level: number; bet: number; multiplier: number; active: boolean }>();

  const LEVELS = [1.05, 1.10, 1.20, 1.35, 1.55, 1.80, 2.15, 2.60, 3.20, 4.00, 5.00, 6.50, 8.50, 11.0, 15.0, 20.0, 30.0, 50.0, 75.0, 100.0];
  const FAIL_PROB = 0.20; // 20% chance of losing on each floor

  ns.on("connection", (socket: AuthedSocket) => {
    socket.on("start", async ({ amount }: { amount: number }) => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (sessions.get(socket.data.userId!)?.active) return socket.emit("error", "Already in a tower session");
      if (!Number.isInteger(amount) || amount < 100) return socket.emit("error", "Min bet: 1 chip");

      try {
        await applyLedgerEntry(prisma, socket.data.userId!, "bet", -amount, "tower_bet");
        sessions.set(socket.data.userId!, { level: 0, bet: amount, multiplier: 1.0, active: true });
        socket.emit("tower_state", { level: 0, multiplier: 1.0, maxLevels: LEVELS.length });
      } catch (err: any) {
        socket.emit("error", err.message || "Bet failed");
      }
    });

    socket.on("climb", async () => {
      const session = sessions.get(socket.data.userId!);
      if (!session || !session.active) return socket.emit("error", "No active session");
      if (session.level >= LEVELS.length) return socket.emit("error", "Already at top");

      const fail = Math.random() < FAIL_PROB;
      if (fail) {
        session.active = false;
        sessions.delete(socket.data.userId!);
        socket.emit("tower_fail", { level: session.level });
      } else {
        session.level++;
        session.multiplier = LEVELS[session.level - 1];
        socket.emit("tower_state", { level: session.level, multiplier: session.multiplier, maxLevels: LEVELS.length });

        if (session.level >= LEVELS.length) {
          // Auto cashout at top
          const payout = Math.floor(session.bet * session.multiplier);
          try { await applyLedgerEntry(prisma, socket.data.userId!, "payout", payout, "tower_win"); } catch {}
          session.active = false;
          sessions.delete(socket.data.userId!);
          socket.emit("tower_cashout", { multiplier: session.multiplier, payout });
        }
      }
    });

    socket.on("cashout", async () => {
      const session = sessions.get(socket.data.userId!);
      if (!session || !session.active || session.level === 0) return socket.emit("error", "Nothing to cash out");

      const payout = Math.floor(session.bet * session.multiplier);
      try { await applyLedgerEntry(prisma, socket.data.userId!, "payout", payout, "tower_win"); } catch (err: any) {
        return socket.emit("error", err.message);
      }
      session.active = false;
      sessions.delete(socket.data.userId!);
      socket.emit("tower_cashout", { multiplier: session.multiplier, payout });
    });
  });
}

// ─────────────────────────────────────────
// MULTIPLAYER ROULETTE — everyone bets on same spin, every 30s
// ─────────────────────────────────────────
export function attachMultiRoulette(io: Server) {
  authMiddleware(io, "/multiroulette");
  const ns = io.of("/multiroulette");

  const BETTING_MS = 25_000;
  const SPIN_MS = 6_000;

  interface Bet { userId: string; username: string; betType: string; amount: number }
  let phase: "betting" | "spinning" | "results" = "betting";
  let bets: Bet[] = [];
  let endsAt = Date.now() + BETTING_MS;
  let lastNumber = 0;
  let history: number[] = [];

  const PAYOUTS: Record<string, number> = {
    red: 2, black: 2, green: 36,
    even: 2, odd: 2,
    "1-18": 2, "19-36": 2,
    "1-12": 3, "13-24": 3, "25-36": 3,
  };

  const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  function getColor(n: number) { return n === 0 ? "green" : RED_NUMBERS.has(n) ? "red" : "black"; }

  function matchesBet(betType: string, num: number): boolean {
    if (betType === "green") return num === 0;
    if (betType === "red") return num !== 0 && RED_NUMBERS.has(num);
    if (betType === "black") return num !== 0 && !RED_NUMBERS.has(num);
    if (betType === "even") return num !== 0 && num % 2 === 0;
    if (betType === "odd") return num !== 0 && num % 2 === 1;
    if (betType === "1-18") return num >= 1 && num <= 18;
    if (betType === "19-36") return num >= 19 && num <= 36;
    if (betType === "1-12") return num >= 1 && num <= 12;
    if (betType === "13-24") return num >= 13 && num <= 24;
    if (betType === "25-36") return num >= 25 && num <= 36;
    const straight = parseInt(betType, 10);
    if (!isNaN(straight)) return straight === num;
    return false;
  }

  function startBetting() {
    phase = "betting";
    bets = [];
    endsAt = Date.now() + BETTING_MS;
    ns.emit("phase", { phase: "betting", endsAt });
    setTimeout(spin, BETTING_MS);
  }

  async function spin() {
    phase = "spinning";
    const num = Math.floor(Math.random() * 37);
    lastNumber = num;
    ns.emit("phase", { phase: "spinning", number: num });

    await new Promise((r) => setTimeout(r, SPIN_MS));

    const results: { username: string; betType: string; amount: number; payout: number }[] = [];
    for (const bet of bets) {
      if (matchesBet(bet.betType, num)) {
        const payout = bet.amount * (PAYOUTS[bet.betType] ?? 2);
        try { await applyLedgerEntry(prisma, bet.userId, "payout", payout, "multiroulette_win"); } catch {}
        results.push({ username: bet.username, betType: bet.betType, amount: bet.amount, payout });
      }
    }

    history.unshift(num);
    if (history.length > 20) history.pop();

    ns.emit("phase", { phase: "results", number: num, color: getColor(num), results, history });
    phase = "results";

    setTimeout(startBetting, 5000);
  }

  startBetting();

  ns.on("connection", (socket: AuthedSocket) => {
    socket.emit("phase", { phase, endsAt, history });

    socket.on("bet", async ({ betType, amount }: { betType: string; amount: number }) => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (phase !== "betting") return socket.emit("error", "Betting is closed");
      if (!PAYOUTS[betType] && isNaN(parseInt(betType, 10))) return socket.emit("error", "Invalid bet type");
      if (!Number.isInteger(amount) || amount < 100) return socket.emit("error", "Min bet: 1 chip");

      try {
        await applyLedgerEntry(prisma, socket.data.userId!, "bet", -amount, "multiroulette_bet");
        bets.push({ userId: socket.data.userId!, username: socket.data.username!, betType, amount });
        socket.emit("bet_ok");
        ns.emit("bets_update", bets.length);
      } catch (err: any) {
        socket.emit("error", err.message || "Bet failed");
      }
    });
  });
}

// ─────────────────────────────────────────
// POKER — simplified 5-card draw, table of up to 6
// ─────────────────────────────────────────
export function attachPoker(io: Server) {
  authMiddleware(io, "/poker");
  const ns = io.of("/poker");

  const SUITS = ["♠","♥","♦","♣"];
  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

  function makeDeck() {
    const deck: string[] = [];
    for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
    return deck;
  }
  function shuffle<T>(arr: T[]): T[] { return arr.sort(() => Math.random() - 0.5); }
  function rankVal(card: string) { return RANKS.indexOf(card.slice(0, -1)); }
  function handScore(hand: string[]): number {
    const ranks = hand.map(rankVal).sort((a,b) => b - a);
    const suits = hand.map((c) => c.slice(-1));
    const flush = suits.every((s) => s === suits[0]);
    const straight = ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5;
    const counts = Object.values(ranks.reduce((m: Record<number,number>, r) => { m[r]=(m[r]||0)+1; return m; }, {})).sort((a,b) => b-a);
    if (straight && flush) return 8;
    if (counts[0] === 4) return 7;
    if (counts[0] === 3 && counts[1] === 2) return 6;
    if (flush) return 5;
    if (straight) return 4;
    if (counts[0] === 3) return 3;
    if (counts[0] === 2 && counts[1] === 2) return 2;
    if (counts[0] === 2) return 1;
    return 0;
  }
  const HAND_NAMES = ["High Card","One Pair","Two Pair","Three of a Kind","Straight","Flush","Full House","Four of a Kind","Straight Flush"];

  interface PokerTable {
    players: Map<string, { socketId: string; username: string; hand: string[]; amount: number; folded: boolean }>;
    phase: "waiting" | "dealing" | "drawing" | "showdown";
    buyIn: number;
    timer: ReturnType<typeof setTimeout> | null;
  }

  const tables = new Map<string, PokerTable>();

  function getOrCreateTable(id: string, buyIn: number): PokerTable {
    if (!tables.has(id)) tables.set(id, { players: new Map(), phase: "waiting", buyIn, timer: null });
    return tables.get(id)!;
  }

  async function startHand(tableId: string) {
    const table = tables.get(tableId);
    if (!table || table.players.size < 2) return;
    table.phase = "dealing";

    const deck = shuffle(makeDeck());
    for (const p of table.players.values()) {
      p.hand = deck.splice(0, 5);
      p.folded = false;
      ns.to(p.socketId).emit("hand", { hand: p.hand });
    }
    ns.to(tableId).emit("table_phase", { phase: "drawing", players: table.players.size });

    // 30s drawing phase
    table.phase = "drawing";
    table.timer = setTimeout(() => showdown(tableId), 30_000);
    ns.to(tableId).emit("draw_timer", 30_000);
  }

  async function showdown(tableId: string) {
    const table = tables.get(tableId);
    if (!table) return;
    table.phase = "showdown";

    const active = [...table.players.entries()].filter(([,p]) => !p.folded);
    if (active.length === 0) { tables.delete(tableId); return; }

    const scored = active.map(([userId, p]) => ({ userId, username: p.username, hand: p.hand, score: handScore(p.hand), amount: p.amount }));
    const best = Math.max(...scored.map((s) => s.score));
    const winners = scored.filter((s) => s.score === best);
    const totalPot = [...table.players.values()].reduce((s, p) => s + p.amount, 0);
    const prize = Math.floor((totalPot * 0.95) / winners.length);

    for (const w of winners) {
      try { await applyLedgerEntry(prisma, w.userId, "payout", prize, "poker_win"); } catch {}
    }

    ns.to(tableId).emit("showdown", {
      hands: scored.map((s) => ({ username: s.username, hand: s.hand, handName: HAND_NAMES[s.score] })),
      winners: winners.map((w) => w.username),
      prize,
    });

    table.players.clear();
    table.phase = "waiting";
    setTimeout(() => {
      if (table.players.size >= 2) startHand(tableId);
    }, 8000);
  }

  ns.on("connection", (socket: AuthedSocket) => {
    let currentTable = "";

    socket.on("join_table", async ({ tableId, buyIn }: { tableId: string; buyIn: number }) => {
      if (!socket.data.userId) return socket.emit("error", "Login required");
      if (!socket.data.isApproved) return socket.emit("error", "Active subscription required. Visit patreon.com/GrilledCoin.");
      if (!Number.isInteger(buyIn) || buyIn < 100) return socket.emit("error", "Min buy-in: 1 chip");

      const table = getOrCreateTable(tableId, buyIn);
      if (table.phase !== "waiting") return socket.emit("error", "Hand in progress");
      if (table.players.size >= 6) return socket.emit("error", "Table full (6 players)");
      if (table.players.has(socket.data.userId!)) return socket.emit("error", "Already at this table");

      try {
        await applyLedgerEntry(prisma, socket.data.userId!, "bet", -buyIn, "poker_buyin");
        table.players.set(socket.data.userId!, { socketId: socket.id, username: socket.data.username!, hand: [], amount: buyIn, folded: false });
        socket.join(tableId);
        currentTable = tableId;
        ns.to(tableId).emit("table_update", { players: [...table.players.values()].map((p) => p.username), phase: table.phase });

        if (table.players.size >= 2 && table.phase === "waiting") {
          if (table.timer) clearTimeout(table.timer);
          table.timer = setTimeout(() => startHand(tableId), 10_000);
          ns.to(tableId).emit("starting_soon", 10_000);
        }
      } catch (err: any) {
        socket.emit("error", err.message || "Failed to join");
      }
    });

    socket.on("draw_cards", ({ tableId, discardIndices }: { tableId: string; discardIndices: number[] }) => {
      const table = tables.get(tableId);
      if (!table) return;
      const player = table.players.get(socket.data.userId!);
      if (!player || table.phase !== "drawing") return;

      const deck = shuffle(makeDeck().filter((c) => !player.hand.includes(c)));
      for (const idx of discardIndices) {
        if (idx >= 0 && idx < 5) player.hand[idx] = deck.pop()!;
      }
      socket.emit("hand", { hand: player.hand });
    });

    socket.on("fold", ({ tableId }: { tableId: string }) => {
      const table = tables.get(tableId);
      if (!table) return;
      const player = table.players.get(socket.data.userId!);
      if (player) player.folded = true;
      const remaining = [...table.players.values()].filter((p) => !p.folded);
      if (remaining.length === 1 && table.phase === "drawing") {
        if (table.timer) clearTimeout(table.timer);
        showdown(tableId);
      }
    });

    socket.on("disconnect", () => {
      if (currentTable) {
        const table = tables.get(currentTable);
        if (table) {
          const p = table.players.get(socket.data.userId!);
          if (p) p.folded = true;
        }
        socket.leave(currentTable);
      }
    });
  });
}
