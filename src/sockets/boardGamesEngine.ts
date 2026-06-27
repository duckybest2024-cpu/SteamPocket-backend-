import { isOwner } from "../lib/owner";
/**
 * Board / Card Games engine — 8 games, one namespace /boardgames
 * Games: chess, checkers, battleship, durak, wildcards, poker, bridge, monopoly
 */
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { applyLedgerEntry } from "../lib/wallet";

// ─── Types ────────────────────────────────────────────────────────────────────────────

interface AuthedSocket extends Socket { data: { userId?: string; username?: string } }

type GameType = "chess" | "checkers" | "battleship" | "durak" | "wildcards" | "poker" | "bridge" | "monopoly";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GameState = any;

interface RoomPlayer {
  userId: string;
  username: string;
  socketId: string;
  ready: boolean;
  isBot?: boolean;
}

interface Room {
  id: string;
  game: GameType;
  betChips: number;
  maxPlayers: number;
  players: RoomPlayer[];
  status: "waiting" | "playing" | "finished";
  gameState: GameState;
  escrowedUserIds: Set<string>;
  hostName: string; // creator's username — used to label the lobby ("X's lobby")
}

// ─── In-memory store ────────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();

// When a player disconnects/leaves mid-game we keep their seat and only forfeit
// after this grace period, so navigating away or a dropped mobile connection
// doesn't instantly lose their bet — they can rejoin. Keyed by `${roomId}:${userId}`.
const forfeitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const FORFEIT_GRACE_MS = 120_000; // 2 minutes to rejoin before forfeiting

// Per-room move clock: a human who stalls past this loses the game.
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TURN_LIMIT_MS = 90_000; // 90 seconds to make a move

// ─── Helpers ───────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns a serialisable snapshot of the room (hidden info redacted for clientUserId). */
function roomView(room: Room, clientUserId?: string): object {
  return {
    id: room.id,
    game: room.game,
    betChips: room.betChips,
    maxPlayers: room.maxPlayers,
    hostName: room.hostName,
    players: room.players.map((p) => ({ userId: p.userId, username: p.username, ready: p.ready, isBot: p.isBot ?? false })),
    status: room.status,
    gameState: redactState(room, clientUserId),
  };
}

function redactState(room: Room, clientUserId?: string): GameState {
  const s = room.gameState;
  if (!s) return s;
  switch (room.game) {
    case "battleship": {
      if (!clientUserId) return s;
      const redacted = JSON.parse(JSON.stringify(s));
      for (const uid of Object.keys(redacted.players ?? {})) {
        if (uid !== clientUserId) {
          const pg = redacted.players[uid];
          if (pg && Array.isArray(pg.grid)) {
            pg.grid = (pg.grid as number[][]).map((row) =>
              row.map((cell) => (cell === 1 ? 0 : cell))
            );
          }
        }
      }
      return redacted;
    }
    case "poker": {
      if (!clientUserId) return s;
      const redacted = JSON.parse(JSON.stringify(s));
      for (const uid of Object.keys(redacted.hands ?? {})) {
        if (uid !== clientUserId && redacted.phase !== "showdown") {
          redacted.hands[uid] = ["??", "??"];
        }
      }
      return redacted;
    }
    case "durak": {
      if (!clientUserId) return s;
      const redacted = JSON.parse(JSON.stringify(s));
      for (const uid of Object.keys(redacted.hands ?? {})) {
        if (uid !== clientUserId) {
          redacted.hands[uid] = (redacted.hands[uid] as string[]).map(() => "??");
        }
      }
      return redacted;
    }
    case "wildcards": {
      if (!clientUserId) return s;
      const redacted = JSON.parse(JSON.stringify(s));
      for (const uid of Object.keys(redacted.hands ?? {})) {
        if (uid !== clientUserId) {
          redacted.hands[uid] = (redacted.hands[uid] as string[]).map(() => "??");
        }
      }
      return redacted;
    }
    default:
      return s;
  }
}

// ─── Winner resolution ────────────────────────────────────────────────────────────

async function resolveWinner(room: Room, winnerId: string | null): Promise<number> {
  const totalPotCents = room.betChips * 100 * room.escrowedUserIds.size;
  const rake = Math.floor(totalPotCents * 0.05);
  const prize = totalPotCents - rake;

  if (winnerId && room.escrowedUserIds.has(winnerId)) {
    await applyLedgerEntry(prisma, winnerId, "bg_win", prize, room.id);
  } else if (!winnerId) {
    const share = Math.floor(prize / room.escrowedUserIds.size);
    for (const uid of room.escrowedUserIds) {
      await applyLedgerEntry(prisma, uid, "bg_draw", share, room.id);
    }
  }
  room.status = "finished";
  return prize;
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 1. CHESS
// ═════════════════════════════════════════════════════════════════════════════════════

function initChessBoard(): string[][] {
  const b: string[][] = Array.from({ length: 8 }, () => Array(8).fill(""));
  const backRank = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    b[0][c] = "b" + backRank[c];
    b[1][c] = "bP";
    b[6][c] = "wP";
    b[7][c] = "w" + backRank[c];
  }
  return b;
}

interface ChessState {
  board: string[][];
  turn: "w" | "b";
  playerMap: { w: string; b: string };
  moves: string[];
  status: "playing" | "checkmate" | "stalemate";
  check: boolean;
  enPassant: [number, number] | null;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  lastMove?: { from: [number, number]; to: [number, number] } | null;
}

function initChess(players: RoomPlayer[]): ChessState {
  return {
    board: initChessBoard(),
    turn: "w",
    playerMap: { w: players[0].userId, b: players[1].userId },
    moves: [],
    status: "playing",
    check: false,
    enPassant: null,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
  };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function chessPseudoMoves(
  board: string[][],
  r: number,
  c: number,
  enPassant: [number, number] | null,
  castling: ChessState["castling"]
): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece[0] as "w" | "b";
  const type = piece[1];
  const moves: [number, number][] = [];
  const opp = color === "w" ? "b" : "w";

  const slide = (dr: number, dc: number) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      if (board[nr][nc]) {
        if (board[nr][nc][0] === opp) moves.push([nr, nc]);
        break;
      }
      moves.push([nr, nc]);
      nr += dr; nc += dc;
    }
  };

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc][0] === opp) moves.push([nr, nc]);
      if (enPassant && nr === enPassant[0] && nc === enPassant[1]) moves.push([nr, nc]);
    }
  } else if (type === "R") {
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]] as [number,number][]) slide(dr, dc);
  } else if (type === "N") {
    for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]] as [number,number][]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc][0] !== color) moves.push([nr, nc]);
    }
  } else if (type === "B") {
    for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) slide(dr, dc);
  } else if (type === "Q") {
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) slide(dr, dc);
  } else if (type === "K") {
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc][0] !== color) moves.push([nr, nc]);
    }
    if (color === "w") {
      if (castling.wK && !board[7][5] && !board[7][6]) moves.push([7, 6]);
      if (castling.wQ && !board[7][3] && !board[7][2] && !board[7][1]) moves.push([7, 2]);
    } else {
      if (castling.bK && !board[0][5] && !board[0][6]) moves.push([0, 6]);
      if (castling.bQ && !board[0][3] && !board[0][2] && !board[0][1]) moves.push([0, 2]);
    }
  }
  return moves;
}

function chessKingPos(board: string[][], color: "w" | "b"): [number, number] | null {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (board[r][c] === color + "K") return [r, c];
  }
  return null;
}

function chessIsInCheck(board: string[][], color: "w" | "b"): boolean {
  const kp = chessKingPos(board, color);
  if (!kp) return false;
  const opp = color === "w" ? "b" : "w";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (board[r][c] && board[r][c][0] === opp) {
      const ms = chessPseudoMoves(board, r, c, null, { wK: false, wQ: false, bK: false, bQ: false });
      if (ms.some(([mr, mc]) => mr === kp[0] && mc === kp[1])) return true;
    }
  }
  return false;
}

function chessApplyOnBoard(
  board: string[][],
  from: [number, number],
  to: [number, number],
  promotion: string | undefined
): string[][] {
  const b = board.map((row) => [...row]);
  const piece = b[from[0]][from[1]];
  b[to[0]][to[1]] = piece;
  b[from[0]][from[1]] = "";
  if (piece === "wP" && to[0] === 0) b[to[0]][to[1]] = "w" + (promotion ?? "Q");
  if (piece === "bP" && to[0] === 7) b[to[0]][to[1]] = "b" + (promotion ?? "Q");
  return b;
}

function chessLegalMoves(state: ChessState, color: "w" | "b"): { from: [number, number]; to: [number, number] }[] {
  const legal: { from: [number, number]; to: [number, number] }[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (!state.board[r][c] || state.board[r][c][0] !== color) continue;
    const pms = chessPseudoMoves(state.board, r, c, state.enPassant, state.castling);
    for (const [tr, tc] of pms) {
      const nb = chessApplyOnBoard(state.board, [r, c], [tr, tc], undefined);
      if (!chessIsInCheck(nb, color)) legal.push({ from: [r, c], to: [tr, tc] });
    }
  }
  return legal;
}

function applyChessMove(
  state: ChessState,
  move: { from: [number, number]; to: [number, number]; promotion?: string },
  userId: string
): ChessState {
  const color = state.turn;
  if (state.playerMap[color] !== userId) throw new Error("NOT_YOUR_TURN");
  if (state.status !== "playing") throw new Error("GAME_OVER");

  const piece = state.board[move.from[0]][move.from[1]];
  if (!piece || piece[0] !== color) throw new Error("ILLEGAL_MOVE");

  const pseudos = chessPseudoMoves(state.board, move.from[0], move.from[1], state.enPassant, state.castling);
  if (!pseudos.some(([r, c]) => r === move.to[0] && c === move.to[1])) throw new Error("ILLEGAL_MOVE");

  let newBoard = chessApplyOnBoard(state.board, move.from, move.to, move.promotion);
  if (chessIsInCheck(newBoard, color)) throw new Error("ILLEGAL_MOVE");

  const newCastling = { ...state.castling };
  if (piece === "wK") { newCastling.wK = false; newCastling.wQ = false; }
  if (piece === "bK") { newCastling.bK = false; newCastling.bQ = false; }
  if (piece === "wR") { if (move.from[1] === 7) newCastling.wK = false; if (move.from[1] === 0) newCastling.wQ = false; }
  if (piece === "bR") { if (move.from[1] === 7) newCastling.bK = false; if (move.from[1] === 0) newCastling.bQ = false; }

  // Castling — move the rook
  if (piece === "wK" && move.from[0] === 7 && move.to[0] === 7) {
    if (move.to[1] === 6) { newBoard[7][5] = "wR"; newBoard[7][7] = ""; }
    if (move.to[1] === 2) { newBoard[7][3] = "wR"; newBoard[7][0] = ""; }
  }
  if (piece === "bK" && move.from[0] === 0 && move.to[0] === 0) {
    if (move.to[1] === 6) { newBoard[0][5] = "bR"; newBoard[0][7] = ""; }
    if (move.to[1] === 2) { newBoard[0][3] = "bR"; newBoard[0][0] = ""; }
  }

  // En passant capture
  let newEnPassant: [number, number] | null = null;
  if (piece === "wP" && move.from[0] === 6 && move.to[0] === 4) newEnPassant = [5, move.to[1]];
  if (piece === "bP" && move.from[0] === 1 && move.to[0] === 3) newEnPassant = [2, move.to[1]];
  if (piece === "wP" && state.enPassant && move.to[0] === state.enPassant[0] && move.to[1] === state.enPassant[1]) {
    newBoard[move.to[0] + 1][move.to[1]] = "";
  }
  if (piece === "bP" && state.enPassant && move.to[0] === state.enPassant[0] && move.to[1] === state.enPassant[1]) {
    newBoard[move.to[0] - 1][move.to[1]] = "";
  }

  const opp = color === "w" ? "b" : "w";
  const inCheck = chessIsInCheck(newBoard, opp);
  const newState: ChessState = {
    board: newBoard,
    turn: opp,
    playerMap: state.playerMap,
    moves: [...state.moves, `${move.from}->${move.to}`],
    status: "playing",
    check: inCheck,
    enPassant: newEnPassant,
    castling: newCastling,
    lastMove: { from: move.from, to: move.to },
  };
  const oppLegal = chessLegalMoves(newState, opp);
  if (oppLegal.length === 0) newState.status = inCheck ? "checkmate" : "stalemate";
  return newState;
}

function getChessWinner(state: ChessState): string | null {
  if (state.status === "checkmate") {
    return state.playerMap[state.turn === "w" ? "b" : "w"];
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 2. CHECKERS
// ═════════════════════════════════════════════════════════════════════════════════════

interface CheckersState {
  board: number[][];
  turn: 0 | 1;
  players: [string, string];
  status: "playing" | "finished";
  winner: number | null;
}

function initCheckers(players: RoomPlayer[]): CheckersState {
  const board: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 1) board[r][c] = 2;
  }
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 1) board[r][c] = 1;
  }
  return { board, turn: 0, players: [players[0].userId, players[1].userId], status: "playing", winner: null };
}

function checkersGetJumps(board: number[][], r: number, c: number, piece: number): [number, number, number, number][] {
  const color = piece === 1 || piece === 3 ? 1 : 2;
  const opp = color === 1 ? [2, 4] : [1, 3];
  const isKing = piece === 3 || piece === 4;
  const fwd = color === 1 ? -1 : 1;
  const dirs: [number, number][] = [[fwd, -1], [fwd, 1]];
  if (isKing) dirs.push([-fwd, -1], [-fwd, 1]);
  const jumps: [number, number, number, number][] = [];
  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (inBounds(lr, lc) && opp.includes(board[mr][mc]) && board[lr][lc] === 0) {
      jumps.push([lr, lc, mr, mc]);
    }
  }
  return jumps;
}

function checkersHasJumps(board: number[][], playerIdx: number): boolean {
  const pieces = playerIdx === 0 ? [1, 3] : [2, 4];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (pieces.includes(board[r][c]) && checkersGetJumps(board, r, c, board[r][c]).length > 0) return true;
  }
  return false;
}

function applyCheckersMove(
  state: CheckersState,
  move: { from: [number, number]; to: [number, number] },
  userId: string
): CheckersState {
  const pIdx = state.players.indexOf(userId) as 0 | 1;
  if (pIdx !== state.turn) throw new Error("NOT_YOUR_TURN");

  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = state.board[fr][fc];
  const pieces = pIdx === 0 ? [1, 3] : [2, 4];
  if (!pieces.includes(piece)) throw new Error("ILLEGAL_MOVE");
  if (state.board[tr][tc] !== 0) throw new Error("ILLEGAL_MOVE");

  const newBoard = state.board.map((row) => [...row]);
  const dr = tr - fr, dc = tc - fc;

  if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
    const jumps = checkersGetJumps(state.board, fr, fc, piece);
    const jump = jumps.find(([lr, lc]) => lr === tr && lc === tc);
    if (!jump) throw new Error("ILLEGAL_MOVE");
    newBoard[jump[2]][jump[3]] = 0;
  } else if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
    if (checkersHasJumps(state.board, pIdx)) throw new Error("MUST_JUMP");
    const isKing = piece === 3 || piece === 4;
    const fwd = pIdx === 0 ? -1 : 1;
    if (!isKing && dr !== fwd) throw new Error("ILLEGAL_MOVE");
  } else {
    throw new Error("ILLEGAL_MOVE");
  }

  newBoard[tr][tc] = piece;
  newBoard[fr][fc] = 0;
  if (piece === 1 && tr === 0) newBoard[tr][tc] = 3;
  if (piece === 2 && tr === 7) newBoard[tr][tc] = 4;

  const oppPieces = pIdx === 0 ? [2, 4] : [1, 3];
  const hasOpp = newBoard.some((row) => row.some((cell) => oppPieces.includes(cell)));
  const finished = !hasOpp;
  const nextTurn: 0 | 1 = pIdx === 0 ? 1 : 0;

  return {
    board: newBoard,
    turn: finished ? state.turn : nextTurn,
    players: state.players,
    status: finished ? "finished" : "playing",
    winner: finished ? pIdx : null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 3. BATTLESHIP
// ═════════════════════════════════════════════════════════════════════════════════════

interface BattleshipPlayerState {
  grid: number[][];
  shots: [number, number][];
  shipsPlaced: boolean;
}

interface BattleshipState {
  phase: "placement" | "battle";
  players: Record<string, BattleshipPlayerState>;
  turn: string;
  status: "playing" | "finished";
  winner: string | null;
  playerOrder: string[];
}

function initBattleship(players: RoomPlayer[]): BattleshipState {
  const pState: Record<string, BattleshipPlayerState> = {};
  for (const p of players) {
    pState[p.userId] = {
      grid: Array.from({ length: 10 }, () => Array(10).fill(0)),
      shots: [],
      shipsPlaced: false,
    };
  }
  return {
    phase: "placement",
    players: pState,
    turn: players[0].userId,
    status: "playing",
    winner: null,
    playerOrder: players.map((p) => p.userId),
  };
}

function applyBattleshipMove(
  state: BattleshipState,
  move: { ships?: { cells: [number, number][] }[]; row?: number; col?: number },
  userId: string
): BattleshipState {
  const s: BattleshipState = JSON.parse(JSON.stringify(state));

  if (s.phase === "placement") {
    if (!move.ships) throw new Error("NEED_SHIPS");
    const SHIP_SIZES = [5, 4, 3, 3, 2];
    if (move.ships.length !== SHIP_SIZES.length) throw new Error("WRONG_SHIP_COUNT");
    const grid = s.players[userId].grid as number[][];
    for (let i = 0; i < move.ships.length; i++) {
      if (move.ships[i].cells.length !== SHIP_SIZES[i]) throw new Error("WRONG_SHIP_SIZE");
      for (const [r, c] of move.ships[i].cells) {
        if (r < 0 || r > 9 || c < 0 || c > 9) throw new Error("OUT_OF_BOUNDS");
        if (grid[r][c] !== 0) throw new Error("OVERLAP");
        grid[r][c] = 1;
      }
    }
    s.players[userId].shipsPlaced = true;
    const allPlaced = s.playerOrder.every((uid) => s.players[uid].shipsPlaced);
    if (allPlaced) s.phase = "battle";
    return s;
  }

  if (s.turn !== userId) throw new Error("NOT_YOUR_TURN");
  if (move.row === undefined || move.col === undefined) throw new Error("NEED_COORDS");
  const { row, col } = move;
  if (row < 0 || row > 9 || col < 0 || col > 9) throw new Error("OUT_OF_BOUNDS");

  const oppId = s.playerOrder.find((uid) => uid !== userId)!;
  const oppGrid = s.players[oppId].grid as number[][];
  if (oppGrid[row][col] === 2 || oppGrid[row][col] === 3) throw new Error("ALREADY_SHOT");

  oppGrid[row][col] = oppGrid[row][col] === 1 ? 2 : 3;
  s.players[userId].shots.push([row, col]);

  const allHit = oppGrid.every((r) => r.every((c) => c !== 1));
  if (allHit) { s.status = "finished"; s.winner = userId; }

  s.turn = oppId;
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 4. DURAK
// ═════════════════════════════════════════════════════════════════════════════════════

const DURAK_RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const DURAK_SUITS = ["♠", "♥", "♦", "♣"];

function makeDurakDeck(): string[] {
  const deck: string[] = [];
  for (const s of DURAK_SUITS) for (const r of DURAK_RANKS) deck.push(r + s);
  return shuffle(deck);
}

function durakRankVal(card: string): number {
  // Suit is the last unicode char; rank is everything before it
  const rank = card.slice(0, -1);
  return DURAK_RANKS.indexOf(rank);
}

function durakCardSuit(card: string): string {
  return card.slice(-1);
}

function durakCardRank(card: string): string {
  return card.slice(0, -1);
}

interface DurakTablePair { attack: string; defend?: string }

interface DurakState {
  deck: string[];
  trump: string;
  hands: Record<string, string[]>;
  table: DurakTablePair[];
  attackerId: string;
  defenderId: string;
  done: string[];
  status: "playing" | "finished";
  winner: string | null;
  turn: "attack" | "defend";
  players: string[];
}

function initDurak(players: RoomPlayer[]): DurakState {
  const deck = makeDurakDeck();
  const trump = durakCardSuit(deck[deck.length - 1]);
  const hands: Record<string, string[]> = {};
  for (const p of players) hands[p.userId] = deck.splice(0, 6);
  return {
    deck,
    trump,
    hands,
    table: [],
    attackerId: players[0].userId,
    defenderId: players[1].userId,
    done: [],
    status: "playing",
    winner: null,
    turn: "attack",
    players: players.map((p) => p.userId),
  };
}

function durakCanBeat(attack: string, defend: string, trump: string): boolean {
  const as = durakCardSuit(attack), ds = durakCardSuit(defend);
  const ar = durakRankVal(attack), dr = durakRankVal(defend);
  if (as === ds) return dr > ar;
  if (ds === trump) return true;
  return false;
}

function durakDraw(state: DurakState, userId: string): void {
  const needed = 6 - state.hands[userId].length;
  if (needed > 0 && state.deck.length > 0) {
    state.hands[userId].push(...state.deck.splice(0, Math.min(needed, state.deck.length)));
  }
}

function applyDurakMove(
  state: DurakState,
  move: { type: string; card?: string; attackCard?: string; defendCard?: string },
  userId: string
): DurakState {
  const s: DurakState = JSON.parse(JSON.stringify(state));
  if (s.status !== "playing") throw new Error("GAME_OVER");

  if (move.type === "attack") {
    if (userId !== s.attackerId || s.turn !== "attack") throw new Error("NOT_YOUR_TURN");
    if (!move.card) throw new Error("NO_CARD");
    const handIdx = s.hands[userId].indexOf(move.card);
    if (handIdx === -1) throw new Error("CARD_NOT_IN_HAND");
    if (s.table.length > 0) {
      const tableRanks = new Set(s.table.flatMap((p) => [durakCardRank(p.attack), p.defend ? durakCardRank(p.defend) : null].filter((x): x is string => x !== null)));
      if (!tableRanks.has(durakCardRank(move.card))) throw new Error("ILLEGAL_MOVE");
    }
    s.hands[userId].splice(handIdx, 1);
    s.table.push({ attack: move.card });
    s.turn = "defend";

  } else if (move.type === "defend") {
    if (userId !== s.defenderId || s.turn !== "defend") throw new Error("NOT_YOUR_TURN");
    if (!move.attackCard || !move.defendCard) throw new Error("NO_CARD");
    const pair = s.table.find((p) => p.attack === move.attackCard && !p.defend);
    if (!pair) throw new Error("CARD_NOT_ON_TABLE");
    const handIdx = s.hands[userId].indexOf(move.defendCard);
    if (handIdx === -1) throw new Error("CARD_NOT_IN_HAND");
    if (!durakCanBeat(move.attackCard, move.defendCard, s.trump)) throw new Error("CANNOT_BEAT");
    s.hands[userId].splice(handIdx, 1);
    pair.defend = move.defendCard;
    if (s.table.every((p) => p.defend)) s.turn = "attack";

  } else if (move.type === "take") {
    if (userId !== s.defenderId) throw new Error("NOT_YOUR_TURN");
    const allCards = s.table.flatMap((p) => [p.attack, p.defend].filter((x): x is string => x !== undefined));
    s.hands[s.defenderId].push(...allCards);
    s.table = [];
    durakDraw(s, s.attackerId);
    s.turn = "attack";
    s.done = [];

  } else if (move.type === "done") {
    if (userId !== s.attackerId || s.turn !== "attack") throw new Error("NOT_YOUR_TURN");
    s.table = [];
    durakDraw(s, s.attackerId);
    durakDraw(s, s.defenderId);
    const oldAtt = s.attackerId;
    s.attackerId = s.defenderId;
    s.defenderId = oldAtt;
    s.turn = "attack";
    s.done = [];

  } else {
    throw new Error("UNKNOWN_MOVE");
  }

  for (const uid of s.players) {
    if (s.hands[uid].length === 0 && s.deck.length === 0) {
      s.status = "finished";
      s.winner = uid;
      break;
    }
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 5. WILD CARDS (UNO-like)
// ═════════════════════════════════════════════════════════════════════════════════════

function makeWildCardsDeck(): string[] {
  const colors = ["red", "blue", "green", "yellow"];
  const cards: string[] = [];
  for (const color of colors) {
    cards.push(`${color}-0`);
    for (let n = 1; n <= 9; n++) { cards.push(`${color}-${n}`); cards.push(`${color}-${n}`); }
    for (let i = 0; i < 2; i++) {
      cards.push(`${color}-Skip`);
      cards.push(`${color}-Reverse`);
      cards.push(`${color}-Draw2`);
    }
  }
  for (let i = 0; i < 4; i++) { cards.push("wild-Wild"); cards.push("wild-WildDraw4"); }
  return shuffle(cards);
}

interface WildCardsState {
  deck: string[];
  discard: string[];
  hands: Record<string, string[]>;
  currentPlayer: string;
  direction: 1 | -1;
  drawPending: number;
  players: string[];
  status: "playing" | "finished";
  winner: string | null;
  color: string;
}

function initWildCards(players: RoomPlayer[]): WildCardsState {
  const deck = makeWildCardsDeck();
  const hands: Record<string, string[]> = {};
  for (const p of players) hands[p.userId] = deck.splice(0, 7);
  let topCard = deck.shift()!;
  while (topCard.startsWith("wild")) { deck.push(topCard); topCard = deck.shift()!; }
  return {
    deck,
    discard: [topCard],
    hands,
    currentPlayer: players[0].userId,
    direction: 1,
    drawPending: 0,
    players: players.map((p) => p.userId),
    status: "playing",
    winner: null,
    color: topCard.split("-")[0],
  };
}

function wildcardIsPlayable(card: string, currentColor: string, topValue: string): boolean {
  if (card.startsWith("wild")) return true;
  const [cardColor, cardValue] = card.split("-");
  return cardColor === currentColor || cardValue === topValue;
}

function applyWildCardsMove(
  state: WildCardsState,
  move: { type: "play" | "draw"; card?: string; chosenColor?: string },
  userId: string
): WildCardsState {
  if (state.currentPlayer !== userId) throw new Error("NOT_YOUR_TURN");
  const s: WildCardsState = JSON.parse(JSON.stringify(state));
  const pidx = s.players.indexOf(userId);
  const n = s.players.length;

  const advance = (skip: boolean) => {
    const next1 = (pidx + s.direction + n) % n;
    const next2 = (pidx + 2 * s.direction + n) % n;
    s.currentPlayer = s.players[skip ? next2 : next1];
  };

  if (move.type === "draw") {
    const drawCount = s.drawPending > 0 ? s.drawPending : 1;
    s.drawPending = 0;
    for (let i = 0; i < drawCount; i++) {
      if (s.deck.length === 0) s.deck = shuffle(s.discard.splice(0, s.discard.length - 1));
      if (s.deck.length > 0) s.hands[userId].push(s.deck.shift()!);
    }
    advance(false);
    return s;
  }

  if (!move.card) throw new Error("NO_CARD");
  const topCard = s.discard[s.discard.length - 1];
  const topValue = topCard.split("-")[1];
  if (!wildcardIsPlayable(move.card, s.color, topValue)) throw new Error("ILLEGAL_MOVE");
  if (s.drawPending > 0) {
    const cardVal = move.card.split("-")[1];
    if (cardVal !== "Draw2" && cardVal !== "WildDraw4") throw new Error("MUST_RESPOND_TO_DRAW");
  }

  const handIdx = s.hands[userId].indexOf(move.card);
  if (handIdx === -1) throw new Error("CARD_NOT_IN_HAND");
  s.hands[userId].splice(handIdx, 1);
  s.discard.push(move.card);

  const [cardColor, cardValue] = move.card.split("-");
  s.color = cardColor === "wild" ? (move.chosenColor ?? "red") : cardColor;

  let skip = false;
  if (cardValue === "Reverse") {
    s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
    if (n === 2) skip = true;
  } else if (cardValue === "Skip") {
    skip = true;
  } else if (cardValue === "Draw2") {
    s.drawPending += 2; skip = true;
  } else if (cardValue === "WildDraw4") {
    s.drawPending += 4; skip = true;
  }

  if (s.hands[userId].length === 0) { s.status = "finished"; s.winner = userId; return s; }

  advance(skip);
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 6. POKER (Texas Hold'em)
// ═════════════════════════════════════════════════════════════════════════════════════

const POKER_SUITS = ["♠", "♥", "♦", "♣"];
const POKER_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function makePokerDeck(): string[] {
  const deck: string[] = [];
  for (const s of POKER_SUITS) for (const r of POKER_RANKS) deck.push(r + s);
  return shuffle(deck);
}

function pokerRankVal(card: string): number { return POKER_RANKS.indexOf(card.slice(0, -1)); }

function pokerEval5(hand: string[]): number {
  const ranks = hand.map(pokerRankVal).sort((a, b) => b - a);
  const suits = hand.map((c) => c.slice(-1));
  const flush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  const straight = uniq.length === 5 && uniq[0] - uniq[4] === 4;
  const lowStraight = uniq.join(",") === "12,3,2,1,0";
  const counts = ranks.reduce<Record<number, number>>((m, r) => { m[r] = (m[r] || 0) + 1; return m; }, {});
  const cv = Object.values(counts).sort((a, b) => b - a);
  const quads = Object.entries(counts).filter(([, v]) => v === 4).map(([k]) => Number(k));
  const trips = Object.entries(counts).filter(([, v]) => v === 3).map(([k]) => Number(k));
  const pairs = Object.entries(counts).filter(([, v]) => v === 2).map(([k]) => Number(k));

  if ((straight || lowStraight) && flush) return 8_000_000 + (lowStraight ? 3 : uniq[0]);
  if (cv[0] === 4) return 7_000_000 + (quads[0] ?? 0);
  if (cv[0] === 3 && cv[1] === 2) return 6_000_000 + (trips[0] ?? 0);
  if (flush) return 5_000_000 + ranks[0];
  if (straight || lowStraight) return 4_000_000 + (lowStraight ? 3 : uniq[0]);
  if (cv[0] === 3) return 3_000_000 + (trips[0] ?? 0);
  if (cv[0] === 2 && cv[1] === 2) return 2_000_000 + Math.max(...pairs);
  if (cv[0] === 2) return 1_000_000 + (pairs[0] ?? 0);
  return ranks[0];
}

function pokerHandScore(cards: string[]): number {
  if (cards.length < 5) return -1;
  const combos = (arr: string[], k: number): string[][] => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    return [...combos(rest, k - 1).map((c) => [first, ...c]), ...combos(rest, k)];
  };
  return Math.max(...combos(cards, 5).map(pokerEval5));
}

interface PokerBGState {
  deck: string[];
  hands: Record<string, [string, string]>;
  community: string[];
  pot: number;
  bets: Record<string, number>;
  phase: "preflop" | "flop" | "turn" | "river" | "showdown";
  currentPlayer: string;
  dealer: number;
  players: string[];
  folded: string[];
  status: "playing" | "finished";
  winner: string | null;
  callAmount: number;
}

function initPoker(players: RoomPlayer[]): PokerBGState {
  const deck = makePokerDeck();
  const pids = players.map((p) => p.userId);
  const hands: Record<string, [string, string]> = {};
  for (const uid of pids) hands[uid] = [deck.pop()!, deck.pop()!];
  const bets: Record<string, number> = {};
  for (const uid of pids) bets[uid] = 0;
  const n = pids.length;
  const sb = 50, bb = 100;
  bets[pids[1 % n]] = sb;
  bets[pids[2 % n]] = (bets[pids[2 % n]] ?? 0) + bb;
  return {
    deck,
    hands,
    community: [],
    pot: sb + bb,
    bets,
    phase: "preflop",
    currentPlayer: pids[Math.min(3, n - 1) % n] ?? pids[0],
    dealer: 0,
    players: pids,
    folded: [],
    status: "playing",
    winner: null,
    callAmount: bb,
  };
}

function pokerAdvancePhase(s: PokerBGState): void {
  const order: PokerBGState["phase"][] = ["preflop", "flop", "turn", "river", "showdown"];
  s.phase = order[order.indexOf(s.phase) + 1];
  for (const uid of s.players) s.bets[uid] = 0;
  s.callAmount = 0;
  if (s.phase === "flop") { s.community.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!); }
  else if (s.phase === "turn" || s.phase === "river") { s.community.push(s.deck.pop()!); }
  if (s.phase !== "showdown") {
    s.currentPlayer = s.players.filter((uid) => !s.folded.includes(uid))[0];
  }
}

function applyPokerMove(
  state: PokerBGState,
  move: { type: "fold" | "call" | "raise"; amount?: number },
  userId: string
): PokerBGState {
  if (state.currentPlayer !== userId) throw new Error("NOT_YOUR_TURN");
  const s: PokerBGState = JSON.parse(JSON.stringify(state));

  if (move.type === "fold") {
    s.folded.push(userId);
    const active = s.players.filter((uid) => !s.folded.includes(uid));
    if (active.length === 1) { s.winner = active[0]; s.status = "finished"; return s; }
  } else if (move.type === "call") {
    const toCall = Math.max(0, s.callAmount - (s.bets[userId] ?? 0));
    s.bets[userId] = (s.bets[userId] ?? 0) + toCall;
    s.pot += toCall;
  } else if (move.type === "raise") {
    const amount = move.amount ?? s.callAmount * 2;
    s.callAmount = amount;
    s.bets[userId] = (s.bets[userId] ?? 0) + amount;
    s.pot += amount;
  }

  const active = s.players.filter((uid) => !s.folded.includes(uid));
  const idx = active.indexOf(userId);
  s.currentPlayer = active[(idx + 1) % active.length];

  const allEqual = active.every((uid) => s.bets[uid] === s.callAmount);
  if (allEqual) {
    pokerAdvancePhase(s);
    if (s.phase === "showdown") {
      let bestScore = -1, bestWinner = "";
      for (const uid of active) {
        const score = pokerHandScore([...s.hands[uid], ...s.community]);
        if (score > bestScore) { bestScore = score; bestWinner = uid; }
      }
      s.winner = bestWinner;
      s.status = "finished";
    }
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 7. BRIDGE (simplified)
// ═════════════════════════════════════════════════════════════════════════════════════

const BRIDGE_SUITS = ["♠", "♥", "♦", "♣"];
const BRIDGE_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function makeBridgeDeck(): string[] {
  const deck: string[] = [];
  for (const s of BRIDGE_SUITS) for (const r of BRIDGE_RANKS) deck.push(r + s);
  return shuffle(deck);
}

function bridgeRankVal(card: string): number { return BRIDGE_RANKS.indexOf(card.slice(0, -1)); }

interface BridgeTrick { cards: { userId: string; card: string }[]; winner: string }

interface BridgeState {
  hands: Record<string, string[]>;
  bid: { level: number; suit: string; bidder: string } | null;
  tricks: BridgeTrick[];
  currentTrick: { userId: string; card: string }[];
  phase: "bidding" | "playing";
  currentPlayer: string;
  players: string[];
  passCount: number;
  status: "playing" | "finished";
  winner: string | null;
}

function initBridge(players: RoomPlayer[]): BridgeState {
  const deck = makeBridgeDeck();
  const hands: Record<string, string[]> = {};
  for (const p of players) hands[p.userId] = deck.splice(0, 13);
  return {
    hands,
    bid: null,
    tricks: [],
    currentTrick: [],
    phase: "bidding",
    currentPlayer: players[0].userId,
    players: players.map((p) => p.userId),
    passCount: 0,
    status: "playing",
    winner: null,
  };
}

function bridgeNextPlayer(players: string[], current: string): string {
  return players[(players.indexOf(current) + 1) % players.length];
}

function applyBridgeMove(
  state: BridgeState,
  move: { type: "bid" | "pass" | "play"; level?: number; suit?: string; card?: string },
  userId: string
): BridgeState {
  if (state.currentPlayer !== userId) throw new Error("NOT_YOUR_TURN");
  const s: BridgeState = JSON.parse(JSON.stringify(state));

  if (s.phase === "bidding") {
    if (move.type === "pass") {
      s.passCount++;
      if (s.passCount >= s.players.length) {
        if (!s.bid) s.bid = { level: 1, suit: "NT", bidder: s.players[0] };
        s.phase = "playing";
        s.currentPlayer = bridgeNextPlayer(s.players, s.bid.bidder);
        return s;
      }
      s.currentPlayer = bridgeNextPlayer(s.players, userId);
    } else if (move.type === "bid") {
      if (move.level === undefined || !move.suit) throw new Error("INVALID_BID");
      if (s.bid && move.level < s.bid.level) throw new Error("BID_TOO_LOW");
      s.bid = { level: move.level, suit: move.suit, bidder: userId };
      s.passCount = 0;
      s.currentPlayer = bridgeNextPlayer(s.players, userId);
    }
  } else {
    if (move.type !== "play" || !move.card) throw new Error("NEED_CARD");
    const handIdx = s.hands[userId].indexOf(move.card);
    if (handIdx === -1) throw new Error("CARD_NOT_IN_HAND");

    if (s.currentTrick.length > 0) {
      const leadSuit = s.currentTrick[0].card.slice(-1);
      const hasSuit = s.hands[userId].some((c) => c.slice(-1) === leadSuit);
      if (hasSuit && move.card.slice(-1) !== leadSuit) throw new Error("MUST_FOLLOW_SUIT");
    }

    s.hands[userId].splice(handIdx, 1);
    s.currentTrick.push({ userId, card: move.card });

    if (s.currentTrick.length === s.players.length) {
      const leadSuit = s.currentTrick[0].card.slice(-1);
      const trumpSuit = s.bid?.suit === "NT" ? null : s.bid?.suit ?? null;
      let winner = s.currentTrick[0];
      for (const played of s.currentTrick.slice(1)) {
        const ws = winner.card.slice(-1);
        const ps = played.card.slice(-1);
        const wr = bridgeRankVal(winner.card);
        const pr = bridgeRankVal(played.card);
        const playedTrump = trumpSuit && ps === trumpSuit;
        const winnerTrump = trumpSuit && ws === trumpSuit;
        if (playedTrump && !winnerTrump) { winner = played; }
        else if (playedTrump && winnerTrump && pr > wr) { winner = played; }
        else if (!playedTrump && !winnerTrump && ps === leadSuit && pr > wr) { winner = played; }
      }
      s.tricks.push({ cards: [...s.currentTrick], winner: winner.userId });
      s.currentTrick = [];
      s.currentPlayer = winner.userId;

      if (s.tricks.length === 13) {
        const team0 = [s.players[0], s.players[2]].filter(Boolean);
        const team1 = [s.players[1], s.players[3]].filter(Boolean);
        const bidderTeam = s.bid && team0.includes(s.bid.bidder) ? team0 : team1;
        const oppTeam = bidderTeam === team0 ? team1 : team0;
        const bidderWins = s.tricks.filter((t) => bidderTeam.includes(t.winner)).length;
        const needed = 6 + (s.bid?.level ?? 1);
        s.status = "finished";
        s.winner = bidderWins >= needed ? (bidderTeam[0] ?? null) : (oppTeam[0] ?? null);
      }
    } else {
      s.currentPlayer = bridgeNextPlayer(s.players, userId);
    }
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 8. MONOPOLY (simplified)
// ═════════════════════════════════════════════════════════════════════════════════════

interface MonopolyProperty {
  name: string;
  price: number;
  rent: number;
  color: string;
  ownerId: string | null;
}

interface MonopolyPlayerState {
  pos: number;
  money: number;
  username: string;
  jailed: boolean;
  bankrupt: boolean;
  jailTurns: number;
}

interface MonopolyState {
  players: Record<string, MonopolyPlayerState>;
  properties: Record<number, MonopolyProperty>;
  currentPlayer: string;
  phase: "roll" | "action";
  diceRoll: [number, number] | null;
  playerOrder: string[];
  status: "playing" | "finished";
  winner: string | null;
  round: number;
}

function buildMonopolyBoard(): Record<number, MonopolyProperty> {
  const props: Record<number, MonopolyProperty> = {};
  const propData: [number, string, number, number, string][] = [
    [1,"Mediterranean Ave",600,200,"brown"],[3,"Baltic Ave",600,400,"brown"],
    [6,"Oriental Ave",1000,600,"light-blue"],[8,"Vermont Ave",1000,600,"light-blue"],[9,"Connecticut Ave",1200,800,"light-blue"],
    [11,"St. Charles Place",1400,1000,"pink"],[13,"States Ave",1400,1000,"pink"],[14,"Virginia Ave",1600,1200,"pink"],
    [16,"St. James Place",1800,1400,"orange"],[18,"Tennessee Ave",1800,1400,"orange"],[19,"New York Ave",2000,1600,"orange"],
    [21,"Kentucky Ave",2200,1800,"red"],[23,"Indiana Ave",2200,1800,"red"],[24,"Illinois Ave",2400,2000,"red"],
    [26,"Atlantic Ave",2600,2200,"yellow"],[27,"Ventnor Ave",2600,2200,"yellow"],[29,"Marvin Gardens",2800,2400,"yellow"],
    [31,"Pacific Ave",3000,2600,"green"],[32,"North Carolina Ave",3000,2600,"green"],[34,"Pennsylvania Ave",3200,2800,"green"],
    [37,"Park Place",3500,3500,"dark-blue"],[39,"Boardwalk",4000,5000,"dark-blue"],
    [5,"Reading Railroad",2000,2500,"railroad"],[15,"Pennsylvania Railroad",2000,2500,"railroad"],
    [25,"B&O Railroad",2000,2500,"railroad"],[35,"Short Line Railroad",2000,2500,"railroad"],
    [12,"Electric Company",1500,1500,"utility"],[28,"Water Works",1500,1500,"utility"],
  ];
  for (const [sq, name, price, rent, color] of propData) {
    props[sq] = { name, price, rent, color, ownerId: null };
  }
  return props;
}

function initMonopoly(players: RoomPlayer[]): MonopolyState {
  const playerStates: Record<string, MonopolyPlayerState> = {};
  for (const p of players) {
    playerStates[p.userId] = { pos: 0, money: 150000, username: p.username, jailed: false, bankrupt: false, jailTurns: 0 };
  }
  return {
    players: playerStates,
    properties: buildMonopolyBoard(),
    currentPlayer: players[0].userId,
    phase: "roll",
    diceRoll: null,
    playerOrder: players.map((p) => p.userId),
    status: "playing",
    winner: null,
    round: 0,
  };
}

function monopolyNextPlayer(s: MonopolyState): string {
  const active = s.playerOrder.filter((uid) => !s.players[uid].bankrupt);
  const idx = active.indexOf(s.currentPlayer);
  return active[(idx + 1) % active.length];
}

function applyMonopolyMove(
  state: MonopolyState,
  move: { type: "roll" | "buy" | "end_turn" },
  userId: string
): MonopolyState {
  if (state.currentPlayer !== userId) throw new Error("NOT_YOUR_TURN");
  const s: MonopolyState = JSON.parse(JSON.stringify(state));
  const p = s.players[userId];

  if (move.type === "roll") {
    if (s.phase !== "roll") throw new Error("NOT_ROLL_PHASE");
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    s.diceRoll = [d1, d2];

    if (p.jailed) {
      if (d1 === d2) { p.jailed = false; p.jailTurns = 0; }
      else {
        p.jailTurns++;
        if (p.jailTurns >= 3) { p.jailed = false; p.jailTurns = 0; p.money -= 5000; }
        s.phase = "action";
        return s;
      }
    }

    const newPos = (p.pos + d1 + d2) % 40;
    if (newPos < p.pos) p.money += 20000; // Pass Go
    p.pos = newPos;

    if (newPos === 30) { p.jailed = true; p.pos = 10; }
    if (newPos === 4 || newPos === 38) p.money = Math.max(0, p.money - 20000);
    s.phase = "action";

  } else if (move.type === "buy") {
    if (s.phase !== "action") throw new Error("NOT_ACTION_PHASE");
    const prop = s.properties[p.pos];
    if (!prop) throw new Error("NO_PROPERTY");
    if (prop.ownerId) throw new Error("ALREADY_OWNED");
    if (p.money < prop.price) throw new Error("INSUFFICIENT_FUNDS");
    p.money -= prop.price;
    prop.ownerId = userId;

  } else if (move.type === "end_turn") {
    if (s.phase !== "action") throw new Error("NOT_ACTION_PHASE");
    const prop = s.properties[p.pos];
    if (prop && prop.ownerId && prop.ownerId !== userId) {
      p.money -= prop.rent;
      s.players[prop.ownerId].money += prop.rent;
      if (p.money <= 0) {
        p.bankrupt = true;
        p.money = 0;
        for (const sq of Object.keys(s.properties).map(Number)) {
          if (s.properties[sq].ownerId === userId) s.properties[sq].ownerId = null;
        }
      }
    }

    const active = s.playerOrder.filter((uid) => !s.players[uid].bankrupt);
    if (active.length === 1) { s.winner = active[0]; s.status = "finished"; return s; }

    const next = monopolyNextPlayer(s);
    if (next === s.playerOrder.filter((uid) => !s.players[uid].bankrupt)[0]) {
      s.round++;
      if (s.round >= 30) {
        let richest = active[0];
        for (const uid of active) if (s.players[uid].money > s.players[richest].money) richest = uid;
        s.winner = richest;
        s.status = "finished";
        return s;
      }
    }

    s.currentPlayer = next;
    s.phase = "roll";
    s.diceRoll = null;
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Game dispatcher
// ═════════════════════════════════════════════════════════════════════════════════════

function startGame(room: Room): void {
  switch (room.game) {
    case "chess":      room.gameState = initChess(room.players); break;
    case "checkers":   room.gameState = initCheckers(room.players); break;
    case "battleship": room.gameState = initBattleship(room.players); break;
    case "durak":      room.gameState = initDurak(room.players); break;
    case "wildcards":  room.gameState = initWildCards(room.players); break;
    case "poker":      room.gameState = initPoker(room.players); break;
    case "bridge":     room.gameState = initBridge(room.players); break;
    case "monopoly":   room.gameState = initMonopoly(room.players); break;
  }
  room.status = "playing";
}

function applyMove(room: Room, move: unknown, userId: string): void {
  switch (room.game) {
    case "chess":
      room.gameState = applyChessMove(room.gameState as ChessState, move as Parameters<typeof applyChessMove>[1], userId);
      break;
    case "checkers":
      room.gameState = applyCheckersMove(room.gameState as CheckersState, move as Parameters<typeof applyCheckersMove>[1], userId);
      break;
    case "battleship":
      room.gameState = applyBattleshipMove(room.gameState as BattleshipState, move as Parameters<typeof applyBattleshipMove>[1], userId);
      break;
    case "durak":
      room.gameState = applyDurakMove(room.gameState as DurakState, move as Parameters<typeof applyDurakMove>[1], userId);
      break;
    case "wildcards":
      room.gameState = applyWildCardsMove(room.gameState as WildCardsState, move as Parameters<typeof applyWildCardsMove>[1], userId);
      break;
    case "poker":
      room.gameState = applyPokerMove(room.gameState as PokerBGState, move as Parameters<typeof applyPokerMove>[1], userId);
      break;
    case "bridge":
      room.gameState = applyBridgeMove(room.gameState as BridgeState, move as Parameters<typeof applyBridgeMove>[1], userId);
      break;
    case "monopoly":
      room.gameState = applyMonopolyMove(room.gameState as MonopolyState, move as Parameters<typeof applyMonopolyMove>[1], userId);
      break;
  }
}

function getWinnerId(room: Room): string | null | undefined {
  const gs = room.gameState as GameState;
  if (!gs) return undefined;
  switch (room.game) {
    case "chess": {
      const s = gs as ChessState;
      return s.status !== "playing" ? getChessWinner(s) : undefined;
    }
    case "checkers": {
      const s = gs as CheckersState;
      return s.status === "finished" ? (s.winner !== null ? s.players[s.winner] : null) : undefined;
    }
    case "battleship": {
      const s = gs as BattleshipState;
      return s.status === "finished" ? s.winner : undefined;
    }
    case "durak": {
      const s = gs as DurakState;
      return s.status === "finished" ? s.winner : undefined;
    }
    case "wildcards": {
      const s = gs as WildCardsState;
      return s.status === "finished" ? s.winner : undefined;
    }
    case "poker": {
      const s = gs as PokerBGState;
      return s.status === "finished" ? s.winner : undefined;
    }
    case "bridge": {
      const s = gs as BridgeState;
      return s.status === "finished" ? s.winner : undefined;
    }
    case "monopoly": {
      const s = gs as MonopolyState;
      return s.status === "finished" ? s.winner : undefined;
    }
    default: return undefined;
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Bots — simple random-legal-move AI for the 8 board games
// ═════════════════════════════════════════════════════════════════════════════════════

/** Returns the userId whose turn it currently is, or null if the game isn't waiting on a turn. */
function getCurrentTurnUserId(room: Room): string | null {
  const gs = room.gameState as GameState;
  if (!gs) return null;
  switch (room.game) {
    case "chess": {
      const s = gs as ChessState;
      return s.status === "playing" ? s.playerMap[s.turn] : null;
    }
    case "checkers": {
      const s = gs as CheckersState;
      return s.status === "playing" ? s.players[s.turn] : null;
    }
    case "battleship": {
      const s = gs as BattleshipState;
      return s.phase === "battle" && s.status === "playing" ? s.turn : null;
    }
    case "durak": {
      const s = gs as DurakState;
      return s.status === "playing" ? (s.turn === "attack" ? s.attackerId : s.defenderId) : null;
    }
    case "wildcards": {
      const s = gs as WildCardsState;
      return s.status === "playing" ? s.currentPlayer : null;
    }
    case "poker": {
      const s = gs as PokerBGState;
      return s.status === "playing" ? s.currentPlayer : null;
    }
    case "bridge": {
      const s = gs as BridgeState;
      return s.status === "playing" ? s.currentPlayer : null;
    }
    case "monopoly": {
      const s = gs as MonopolyState;
      return s.status === "playing" ? s.currentPlayer : null;
    }
    default: return null;
  }
}

function botChessMove(state: ChessState): { from: [number, number]; to: [number, number] } | null {
  const moves = chessLegalMoves(state, state.turn);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function botCheckersMove(state: CheckersState): { from: [number, number]; to: [number, number] } | null {
  const board = state.board;
  const pIdx = state.turn;
  const mustJump = checkersHasJumps(board, pIdx);
  const moves: { from: [number, number]; to: [number, number] }[] = [];
  const pieces = pIdx === 0 ? [1, 3] : [2, 4];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (!pieces.includes(board[r][c])) continue;
    if (mustJump) {
      for (const [lr, lc] of checkersGetJumps(board, r, c, board[r][c])) {
        moves.push({ from: [r, c], to: [lr, lc] });
      }
    } else {
      const isKing = board[r][c] === 3 || board[r][c] === 4;
      const fwd = pIdx === 0 ? -1 : 1;
      const dirs: [number, number][] = isKing ? [[fwd, -1], [fwd, 1], [-fwd, -1], [-fwd, 1]] : [[fwd, -1], [fwd, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] === 0) moves.push({ from: [r, c], to: [nr, nc] });
      }
    }
  }
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

/** Random, non-overlapping fleet placement used when a bot needs to place its ships. */
function generateBattleshipShips(): { cells: [number, number][] }[] {
  const SHIP_SIZES = [5, 4, 3, 3, 2];
  const grid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  const ships: { cells: [number, number][] }[] = [];
  for (const size of SHIP_SIZES) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * (horizontal ? 10 : 10 - size + 1));
      const col = Math.floor(Math.random() * (horizontal ? 10 - size + 1 : 10));
      const cells: [number, number][] = [];
      for (let i = 0; i < size; i++) cells.push(horizontal ? [row, col + i] : [row + i, col]);
      if (cells.every(([r, c]) => grid[r][c] === 0)) {
        for (const [r, c] of cells) grid[r][c] = 1;
        ships.push({ cells });
        placed = true;
      }
    }
  }
  return ships;
}

function botBattleshipMove(state: BattleshipState, botUserId: string): { row: number; col: number } | null {
  const oppId = state.playerOrder.find((uid) => uid !== botUserId);
  if (!oppId) return null;
  const oppGrid = state.players[oppId].grid as number[][];
  const candidates: [number, number][] = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    if (oppGrid[r][c] === 0 || oppGrid[r][c] === 1) candidates.push([r, c]);
  }
  if (candidates.length === 0) return null;
  const [row, col] = candidates[Math.floor(Math.random() * candidates.length)];
  return { row, col };
}

function botDurakMove(
  state: DurakState,
  botUserId: string
): { type: string; card?: string; attackCard?: string; defendCard?: string } | null {
  const hand = state.hands[botUserId];
  if (state.turn === "attack" && botUserId === state.attackerId) {
    if (state.table.length === 0) {
      if (hand.length === 0) return null;
      return { type: "attack", card: hand[Math.floor(Math.random() * hand.length)] };
    }
    const tableRanks = new Set(
      state.table.flatMap((p) => [durakCardRank(p.attack), p.defend ? durakCardRank(p.defend) : null].filter((x): x is string => x !== null))
    );
    const playable = hand.filter((c) => tableRanks.has(durakCardRank(c)));
    if (playable.length > 0 && Math.random() < 0.5) {
      return { type: "attack", card: playable[Math.floor(Math.random() * playable.length)] };
    }
    return { type: "done" };
  }
  if (state.turn === "defend" && botUserId === state.defenderId) {
    const pair = state.table.find((p) => !p.defend);
    if (!pair) return null;
    const beatable = hand.filter((c) => durakCanBeat(pair.attack, c, state.trump));
    if (beatable.length === 0) return { type: "take" };
    return { type: "defend", attackCard: pair.attack, defendCard: beatable[Math.floor(Math.random() * beatable.length)] };
  }
  return null;
}

function botWildCardsMove(
  state: WildCardsState,
  botUserId: string
): { type: "play" | "draw"; card?: string; chosenColor?: string } {
  const hand = state.hands[botUserId];
  const topCard = state.discard[state.discard.length - 1];
  const topValue = topCard.split("-")[1];
  let playable = hand.filter((c) => wildcardIsPlayable(c, state.color, topValue));
  if (state.drawPending > 0) {
    playable = playable.filter((c) => { const v = c.split("-")[1]; return v === "Draw2" || v === "WildDraw4"; });
  }
  if (playable.length === 0) return { type: "draw" };
  const card = playable[Math.floor(Math.random() * playable.length)];
  const colors = ["red", "blue", "green", "yellow"];
  const chosenColor = card.startsWith("wild") ? colors[Math.floor(Math.random() * colors.length)] : undefined;
  return { type: "play", card, chosenColor };
}

function botPokerMove(state: PokerBGState, botUserId: string): { type: "fold" | "call" | "raise" } {
  const toCall = Math.max(0, state.callAmount - (state.bets[botUserId] ?? 0));
  const r = Math.random();
  if (toCall > 0 && r < 0.15) return { type: "fold" };
  if (r < 0.85) return { type: "call" };
  return { type: "raise" };
}

function botBridgeMove(
  state: BridgeState,
  botUserId: string
): { type: "bid" | "pass" | "play"; level?: number; suit?: string; card?: string } | null {
  if (state.phase === "bidding") {
    if (Math.random() < 0.7) return { type: "pass" };
    const level = (state.bid?.level ?? 0) + 1;
    if (level > 7) return { type: "pass" };
    const suits = ["♠", "♥", "♦", "♣", "NT"];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    return { type: "bid", level, suit };
  }
  const hand = state.hands[botUserId];
  let legal = hand;
  if (state.currentTrick.length > 0) {
    const leadSuit = state.currentTrick[0].card.slice(-1);
    const followable = hand.filter((c) => c.slice(-1) === leadSuit);
    if (followable.length > 0) legal = followable;
  }
  if (legal.length === 0) return null;
  return { type: "play", card: legal[Math.floor(Math.random() * legal.length)] };
}

function botMonopolyMove(state: MonopolyState, botUserId: string): { type: "roll" | "buy" | "end_turn" } {
  if (state.phase === "roll") return { type: "roll" };
  const p = state.players[botUserId];
  const prop = state.properties[p.pos];
  if (prop && !prop.ownerId && p.money >= prop.price && Math.random() < 0.7) {
    return { type: "buy" };
  }
  return { type: "end_turn" };
}

/** Computes a simple, non-strategic legal move for whichever bot's turn it currently is. */
function computeBotMove(room: Room, botUserId: string): unknown {
  switch (room.game) {
    case "chess": return botChessMove(room.gameState as ChessState);
    case "checkers": return botCheckersMove(room.gameState as CheckersState);
    case "battleship": return botBattleshipMove(room.gameState as BattleshipState, botUserId);
    case "durak": return botDurakMove(room.gameState as DurakState, botUserId);
    case "wildcards": return botWildCardsMove(room.gameState as WildCardsState, botUserId);
    case "poker": return botPokerMove(room.gameState as PokerBGState, botUserId);
    case "bridge": return botBridgeMove(room.gameState as BridgeState, botUserId);
    case "monopoly": return botMonopolyMove(room.gameState as MonopolyState, botUserId);
    default: return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Main attach function
// ═════════════════════════════════════════════════════════════════════════════════════

export function attachBoardGames(io: Server): void {
  io.of("/boardgames").use(async (socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
        const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true } });
        if (user) { socket.data.userId = user.id; socket.data.username = user.username; }
      } catch { /* invalid token — treat as anonymous */ }
    }
    next();
  });

  const ns = io.of("/boardgames");

  /** Emit room-update to every player in the room with their own redacted view. */
  function broadcastRoom(room: Room): void {
    for (const p of room.players) {
      if (!p.socketId) continue; // bots have no socket
      ns.to(p.socketId).emit("bg:room-update", roomView(room, p.userId));
    }
  }

  /** Resolve the winner, persist history, notify clients, and remove the room. */
  async function finishGame(room: Room, winnerId: string | null): Promise<void> {
    const winnerPlayer = winnerId ? room.players.find((p) => p.userId === winnerId) : null;
    let prize = 0;
    try { prize = await resolveWinner(room, winnerId); } catch { /* ignore */ }
    ns.to(room.id).emit("bg:game-over", { winner: winnerPlayer?.username ?? null, prize });
    try {
      await prisma.boardGameRoom.create({
        data: {
          id: room.id,
          game: room.game,
          status: "finished",
          betChips: room.betChips,
          maxPlayers: room.maxPlayers,
          players: JSON.stringify(room.players.map((p) => p.userId)),
          winnerId: winnerId ?? undefined,
          state: JSON.stringify(room.gameState),
        },
      });
    } catch { /* ignore db errors */ }
    clearTurnTimer(room.id);
    rooms.delete(room.id);
  }

  /**
   * Checks whether every player in the room is ready and, if so, escrows bets
   * and starts the game. Called both when a human readies up and when a bot
   * is added — adding a bot can flip "every player ready" to true without
   * anyone touching the ready button again, so both call sites must re-check.
   */
  async function tryStartGame(room: Room): Promise<void> {
    if (room.status !== "waiting") return;
    if (!room.players.every((p) => p.ready)) return;
    if (room.players.length < 2) return;
    if (room.game === "bridge" && room.players.length !== 4) {
      for (const p of room.players) p.ready = false;
      ns.to(room.id).emit("bg:error", { message: "Bridge requires exactly 4 players" });
      return;
    }

    // 1 chip = 100 cents. Must match the pot math in resolveWinner
    // (betChips * 100) — using 5000 here charged 50x the bet, which made
    // affordable bets wrongly fail with "Insufficient chips".
    const deductCents = room.betChips * 100;
    const failed: string[] = [];

    for (const p of room.players) {
      if (p.isBot) continue; // bots never wager real chips
      try {
        await applyLedgerEntry(prisma, p.userId, "bg_bet", -deductCents, room.id);
        room.escrowedUserIds.add(p.userId);
      } catch {
        failed.push(p.username);
      }
    }

    if (failed.length > 0) {
      for (const uid of room.escrowedUserIds) {
        try { await applyLedgerEntry(prisma, uid, "bg_refund", deductCents, room.id); } catch { /* ignore */ }
      }
      room.escrowedUserIds.clear();
      for (const p of room.players) p.ready = false;
      ns.to(room.id).emit("bg:error", { message: `Insufficient chips: ${failed.join(", ")}` });
      return;
    }

    startGame(room);
    if (room.game === "battleship") {
      for (const p of room.players) {
        if (p.isBot) {
          try { applyMove(room, { ships: generateBattleshipShips() }, p.userId); } catch { /* ignore */ }
        }
      }
    }
    broadcastRoom(room);
    await runBotTurns(room);
    armTurnTimer(room);
  }

  const BOT_MOVE_DELAY_MS = 700;

  /** Drives bot turns one at a time (with a pacing delay) until a human's turn or game-over. */
  async function runBotTurns(room: Room, depth = 0): Promise<void> {
    if (depth > 300) return; // safety cap against any move-generation bug looping forever
    if (room.status !== "playing") return;
    const turnUserId = getCurrentTurnUserId(room);
    if (!turnUserId) return;
    const player = room.players.find((p) => p.userId === turnUserId);
    if (!player?.isBot) return;

    await new Promise((resolve) => setTimeout(resolve, BOT_MOVE_DELAY_MS));
    if (!rooms.has(room.id) || room.status !== "playing") return;

    // If the bot can't produce a valid move (AI edge case / bug), it must
    // forfeit rather than silently freeze the game on its turn forever — bots
    // never time out, so a stuck bot would otherwise hang the room.
    let move: unknown;
    try {
      move = computeBotMove(room, turnUserId);
    } catch {
      await botForfeit(room, turnUserId);
      return;
    }
    if (move === null || move === undefined) {
      await botForfeit(room, turnUserId);
      return;
    }

    try {
      applyMove(room, move, turnUserId);
    } catch {
      await botForfeit(room, turnUserId);
      return;
    }

    broadcastRoom(room);

    const winnerId = getWinnerId(room);
    if (winnerId !== undefined) {
      await finishGame(room, winnerId);
      return;
    }

    await runBotTurns(room, depth + 1);
  }

  function clearTurnTimer(roomId: string): void {
    const t = turnTimers.get(roomId);
    if (t) { clearTimeout(t); turnTimers.delete(roomId); }
  }

  /** A bot couldn't move — resolve the game in favour of a human so it can't hang. */
  async function botForfeit(room: Room, botUserId: string): Promise<void> {
    const human = room.players.find((p) => !p.isBot && p.userId !== botUserId);
    ns.to(room.id).emit("bg:bot-stuck", {});
    await finishGame(room, human?.userId ?? null);
  }

  /**
   * (Re)start the move clock for whoever is on turn. If it's a human and they
   * don't move within TURN_LIMIT_MS, they forfeit. Bots are skipped (they move
   * on their own). Call this whenever the turn lands back on a human.
   */
  function armTurnTimer(room: Room): void {
    clearTurnTimer(room.id);
    if (room.status !== "playing") return;
    const turnUserId = getCurrentTurnUserId(room);
    if (!turnUserId) return;
    const player = room.players.find((p) => p.userId === turnUserId);
    if (!player || player.isBot) return; // bots can't time out
    turnTimers.set(room.id, setTimeout(() => {
      turnTimers.delete(room.id);
      const r = rooms.get(room.id);
      if (!r || r.status !== "playing") return;
      if (getCurrentTurnUserId(r) !== turnUserId) return; // they already moved
      ns.to(r.id).emit("bg:timeout", { who: player.username });
      const winner = r.players.find((p) => p.userId !== turnUserId);
      void finishGame(r, winner?.userId ?? null);
    }, TURN_LIMIT_MS));
  }

  /** Forfeit a player after the grace period if they haven't rejoined. */
  function scheduleForfeit(room: Room, userId: string): void {
    const key = `${room.id}:${userId}`;
    const existing = forfeitTimers.get(key);
    if (existing) clearTimeout(existing);
    forfeitTimers.set(key, setTimeout(() => {
      forfeitTimers.delete(key);
      const r = rooms.get(room.id);
      if (!r || r.status !== "playing") return;
      const p = r.players.find((pp) => pp.userId === userId);
      if (!p || p.socketId !== "") return; // they rejoined — never mind
      const winner = r.players.find((pp) => pp.userId !== userId);
      void finishGame(r, winner?.userId ?? null);
    }, FORFEIT_GRACE_MS));
  }

  /**
   * A player left/disconnected. Mid-game we DON'T forfeit immediately — we keep
   * their seat and start a grace timer so they can rejoin (navigating away or a
   * dropped mobile connection shouldn't cost the bet). Only Resign forfeits at
   * once. In the waiting room (nothing escrowed yet) we just free the seat.
   */
  async function handleLeave(room: Room, userId: string): Promise<void> {
    const pidx = room.players.findIndex((p) => p.userId === userId);
    if (pidx === -1) return;

    if (room.status === "playing") {
      const p = room.players[pidx];
      p.socketId = ""; // mark detached, keep the seat
      scheduleForfeit(room, userId);
      ns.to(room.id).emit("bg:opponent-left", { who: p.username, graceMs: FORFEIT_GRACE_MS });
    } else if (room.status === "waiting") {
      room.players.splice(pidx, 1);
      if (room.players.length === 0) {
        rooms.delete(room.id);
      } else {
        broadcastRoom(room);
      }
    }
  }

  ns.on("connection", (socket: AuthedSocket) => {
    let currentRoomId = "";

    // ── bg:rejoin ──────────────────────────────────────────────────────────────────
    // On (re)entering Board Games, snap back into any game the player is still in.
    socket.on("bg:rejoin", () => {
      if (!socket.data.userId) return socket.emit("bg:rejoin", { room: null });
      const room = [...rooms.values()].find(
        (r) => r.status !== "finished" && r.players.some((p) => p.userId === socket.data.userId)
      );
      if (!room) return socket.emit("bg:rejoin", { room: null });
      const p = room.players.find((pp) => pp.userId === socket.data.userId);
      if (p) p.socketId = socket.id; // re-attach
      const key = `${room.id}:${socket.data.userId}`;
      const t = forfeitTimers.get(key);
      if (t) { clearTimeout(t); forfeitTimers.delete(key); } // cancel pending forfeit
      socket.join(room.id);
      currentRoomId = room.id;
      socket.emit("bg:rejoin", { room: roomView(room, socket.data.userId) });
      ns.to(room.id).emit("bg:opponent-rejoined", { who: socket.data.username });
      void runBotTurns(room).then(() => armTurnTimer(room)); // nudge bot, then re-arm clock
    });

    // ── bg:rooms ───────────────────────────────────────────────────────────────────
    socket.on("bg:rooms", () => {
      const list = [...rooms.values()]
        .filter((r) => r.status !== "finished")
        .map((r) => ({
          id: r.id,
          game: r.game,
          betChips: r.betChips,
          maxPlayers: r.maxPlayers,
          hostName: r.hostName,
          playerCount: r.players.length,
          status: r.status,
        }));
      socket.emit("bg:rooms", { rooms: list });
    });

    // ── bg:create ──────────────────────────────────────────────────────────────────
    socket.on("bg:create", ({ game, betChips, maxPlayers }: { game: GameType; betChips: number; maxPlayers: number }) => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      const validGames: GameType[] = ["chess","checkers","battleship","durak","wildcards","poker","bridge","monopoly"];
      if (!validGames.includes(game)) return socket.emit("bg:error", { message: "Invalid game" });
      if (!Number.isInteger(betChips) || betChips < 1) return socket.emit("bg:error", { message: "Invalid bet" });
      const maxByGame: Record<GameType, number> = { chess:2, checkers:2, battleship:2, durak:2, wildcards:6, poker:6, bridge:4, monopoly:6 };
      const minByGame: Record<GameType, number> = { chess:2, checkers:2, battleship:2, durak:2, wildcards:2, poker:2, bridge:4, monopoly:2 };
      const clampedMax = Math.min(Math.max(maxPlayers, minByGame[game]), maxByGame[game]);

      const roomId = crypto.randomUUID();
      const room: Room = {
        id: roomId,
        game,
        betChips,
        maxPlayers: clampedMax,
        players: [{ userId: socket.data.userId, username: socket.data.username!, socketId: socket.id, ready: false }],
        status: "waiting",
        gameState: null,
        escrowedUserIds: new Set(),
        hostName: socket.data.username!,
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      currentRoomId = roomId;
      socket.emit("bg:create", { roomId, room: roomView(room, socket.data.userId) });
    });

    // ── bg:join ────────────────────────────────────────────────────────────────────
    socket.on("bg:join", ({ roomId }: { roomId: string }) => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      const room = rooms.get(roomId);
      if (!room) return socket.emit("bg:error", { message: "Room not found" });
      if (room.status !== "waiting") return socket.emit("bg:error", { message: "Game already started" });
      if (room.players.length >= room.maxPlayers) return socket.emit("bg:error", { message: "Room is full" });
      if (room.players.some((p) => p.userId === socket.data.userId)) return socket.emit("bg:error", { message: "Already in room" });

      room.players.push({ userId: socket.data.userId, username: socket.data.username!, socketId: socket.id, ready: false });
      socket.join(roomId);
      currentRoomId = roomId;
      broadcastRoom(room);
    });

    // ── bg:add-bot ────────────────────────────────────────────────────────────────
    socket.on("bg:add-bot", async () => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      if (!currentRoomId) return socket.emit("bg:error", { message: "Not in a room" });
      const room = rooms.get(currentRoomId);
      if (!room) return socket.emit("bg:error", { message: "Room not found" });
      if (room.status !== "waiting") return socket.emit("bg:error", { message: "Game already started" });
      if (room.players[0]?.userId !== socket.data.userId) {
        return socket.emit("bg:error", { message: "Only the room creator can add bots" });
      }
      if (room.players.length >= room.maxPlayers) return socket.emit("bg:error", { message: "Room is full" });

      const botNumber = room.players.filter((p) => p.isBot).length + 1;
      room.players.push({
        userId: `bot-${crypto.randomUUID()}`,
        username: `Bot ${botNumber}`,
        socketId: "",
        ready: true,
        isBot: true,
      });
      broadcastRoom(room);
      // Adding a bot can make every remaining player ready (e.g. the creator
      // already readied up before adding a bot) — re-check so the game isn't
      // left stuck in the waiting room forever.
      await tryStartGame(room);
    });

    // ── bg:remove-bot ─────────────────────────────────────────────────────────────
    socket.on("bg:remove-bot", ({ botUserId }: { botUserId: string }) => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      if (!currentRoomId) return socket.emit("bg:error", { message: "Not in a room" });
      const room = rooms.get(currentRoomId);
      if (!room) return socket.emit("bg:error", { message: "Room not found" });
      if (room.status !== "waiting") return socket.emit("bg:error", { message: "Game already started" });
      if (room.players[0]?.userId !== socket.data.userId) {
        return socket.emit("bg:error", { message: "Only the room creator can remove bots" });
      }
      const idx = room.players.findIndex((p) => p.userId === botUserId && p.isBot);
      if (idx === -1) return socket.emit("bg:error", { message: "Bot not found" });
      room.players.splice(idx, 1);
      broadcastRoom(room);
    });

    // ── bg:leave ──────────────────────────────────────────────────────────────────
    socket.on("bg:leave", async () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room) await handleLeave(room, socket.data.userId!);
      socket.leave(currentRoomId);
      currentRoomId = "";
    });

    // ── bg:resign ───────────────────────────────────────────────────────────────────
    // Concede a game in progress — the (first) opponent is awarded the win/pot.
    socket.on("bg:resign", async () => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      if (!currentRoomId) return socket.emit("bg:error", { message: "Not in a room" });
      const room = rooms.get(currentRoomId);
      if (!room || room.status !== "playing") return socket.emit("bg:error", { message: "No game in progress" });
      if (!room.players.some((p) => p.userId === socket.data.userId)) return;
      const opponent = room.players.find((p) => p.userId !== socket.data.userId);
      ns.to(room.id).emit("bg:resigned", { who: socket.data.username });
      await finishGame(room, opponent?.userId ?? null);
    });

    // ── bg:ready ──────────────────────────────────────────────────────────────────
    socket.on("bg:ready", async () => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      if (!currentRoomId) return socket.emit("bg:error", { message: "Not in a room" });
      const room = rooms.get(currentRoomId);
      if (!room) return socket.emit("bg:error", { message: "Room not found" });
      if (room.status !== "waiting") return socket.emit("bg:error", { message: "Game already started" });
      const player = room.players.find((p) => p.userId === socket.data.userId);
      if (!player) return socket.emit("bg:error", { message: "Not in this room" });
      player.ready = true;
      broadcastRoom(room);

      await tryStartGame(room);
    });

    // ── bg:move ───────────────────────────────────────────────────────────────────
    socket.on("bg:move", async ({ move }: { move: unknown }) => {
      if (!socket.data.userId) return socket.emit("bg:error", { message: "Login required" });
      if (!currentRoomId) return socket.emit("bg:error", { message: "Not in a room" });
      const room = rooms.get(currentRoomId);
      if (!room) return socket.emit("bg:error", { message: "Room not found" });
      if (room.status !== "playing") return socket.emit("bg:error", { message: "Game not in progress" });

      try {
        applyMove(room, move, socket.data.userId);
      } catch (err: unknown) {
        return socket.emit("bg:error", { message: err instanceof Error ? err.message : "ILLEGAL_MOVE" });
      }

      broadcastRoom(room);

      const winnerId = getWinnerId(room);
      if (winnerId !== undefined) {
        await finishGame(room, winnerId);
      } else {
        await runBotTurns(room);
        armTurnTimer(room);
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room) await handleLeave(room, socket.data.userId ?? "");
    });
  });
}
