import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireApproved, AuthedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { applyLedgerEntry, InsufficientFundsError, levelFromXp, xpForWager } from "../lib/wallet";
import { SCRATCH_CATALOG, getTicketById, ScratchPrize } from "../lib/scratchCatalog";

export const scratchRouter = Router();

scratchRouter.get("/tickets", (_req, res) => { res.json({ tickets: SCRATCH_CATALOG }); });

function pickPrize(prizes: ScratchPrize[]): ScratchPrize {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const prize of prizes) { roll -= prize.weight; if (roll <= 0) return prize; }
  return prizes[prizes.length - 1];
}

function buildGrid(prizes: ScratchPrize[], wonPrize: ScratchPrize): ScratchPrize[] {
  const nonWinPrizes = prizes.filter((p) => p.chips === 0 || p.chips !== wonPrize.chips);
  if (wonPrize.chips > 0) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const winLine = lines[Math.floor(Math.random() * lines.length)];
    const grid: ScratchPrize[] = new Array(9);
    for (const idx of winLine) grid[idx] = wonPrize;
    const filler = nonWinPrizes.length > 0 ? nonWinPrizes : prizes;
    for (let i = 0; i < 9; i++) { if (!grid[i]) grid[i] = filler[Math.floor(Math.random() * filler.length)]; }
    return grid;
  } else {
    const grid: ScratchPrize[] = [];
    for (let i = 0; i < 9; i++) {
      let candidate: ScratchPrize; let attempts = 0;
      do { candidate = prizes[Math.floor(Math.random() * prizes.length)]; attempts++; } while (attempts < 20 && wouldCompleteWin(grid, i, candidate));
      grid.push(candidate);
    }
    return grid;
  }
}

function wouldCompleteWin(grid: ScratchPrize[], newIdx: number, candidate: ScratchPrize): boolean {
  if (candidate.chips === 0) return false;
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const testGrid = [...grid, candidate];
  for (const line of lines) {
    if (!line.includes(newIdx)) continue;
    const filled = line.filter((i) => i < testGrid.length);
    if (filled.length === 3) { const allMatch = filled.every((i) => testGrid[i].chips === candidate.chips && testGrid[i].chips > 0); if (allMatch) return true; }
  }
  return false;
}

scratchRouter.post("/buy/:ticketId", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const ticketId = req.params.ticketId;
  const ticket = getTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const userId = req.userId!;
  const costCents = ticket.priceChips * 100;
  try {
    const { betId, balance } = await prisma.$transaction(async (tx) => {
      await applyLedgerEntry(tx, userId, "bet", -costCents, undefined);
      const wonPrize = pickPrize(ticket.prizes);
      const grid = buildGrid(ticket.prizes, wonPrize);
      const bet = await tx.bet.create({ data: { userId, game: "scratch", amount: costCents, payout: 0, multiplier: 0, result: "loss", state: JSON.stringify({ ticketId, wonPrize, grid, revealed: false }), clientSeed: "", serverSeed: "", nonce: 0 } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return { betId: bet.id, balance: user.balance };
    });
    res.status(201).json({ betId, balance, ticketId });
  } catch (err) {
    if (err instanceof InsufficientFundsError) return res.status(400).json({ error: "Insufficient balance" });
    console.error("Scratch buy error:", err);
    res.status(500).json({ error: "Something went wrong — please try again" });
  }
});

const revealSchema = z.object({ cell: z.number().int().min(0).max(8).optional() });

scratchRouter.post("/reveal/:betId", requireAuth, requireApproved, async (req: AuthedRequest, res) => {
  const betId = req.params.betId;
  const userId = req.userId!;
  const parsed = revealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const bet = await prisma.bet.findFirst({ where: { id: betId, userId } });
    if (!bet) return res.status(404).json({ error: "Scratch ticket not found" });
    if (bet.game !== "scratch") return res.status(400).json({ error: "Not a scratch ticket" });
    const state = JSON.parse(bet.state as string) as { ticketId: string; wonPrize: ScratchPrize; grid: ScratchPrize[]; revealed: boolean; revealedCells?: number[] };
    if (state.revealed) {
      return res.json({ alreadyRevealed: true, grid: state.grid, wonPrize: state.wonPrize, payout: bet.payout, balance: (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance });
    }
    const { cell } = parsed.data;
    const revealAll = cell === undefined;
    if (!revealAll) {
      const revealedCells = state.revealedCells ?? [];
      if (!revealedCells.includes(cell)) revealedCells.push(cell);
      await prisma.bet.update({ where: { id: betId }, data: { state: JSON.stringify({ ...state, revealedCells }) } });
      return res.json({ cell, prize: state.grid[cell], revealedCells, grid: state.grid, wonPrize: state.wonPrize, revealed: false });
    }
    const wonPrize = state.wonPrize;
    const payoutCents = wonPrize.chips * 100;
    const { payout, balance, level, xp, leveledUp } = await prisma.$transaction(async (tx) => {
      let userRecord = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      let actualPayout = 0;
      if (payoutCents > 0) {
        let creditAmount = payoutCents;
        const netProfit = payoutCents - bet.amount;
        if (netProfit > 0) creditAmount = payoutCents - Math.floor(netProfit * 0.05);
        userRecord = await applyLedgerEntry(tx, userId, "payout", creditAmount, undefined);
        actualPayout = creditAmount;
      }
      const gainedXp = xpForWager(bet.amount);
      const newXp = userRecord.xp + gainedXp; const newLevel = levelFromXp(newXp); const didLevelUp = newLevel > userRecord.level;
      const levelBonus = didLevelUp ? newLevel * 500 : 0;
      userRecord = await tx.user.update({ where: { id: userId }, data: { xp: newXp, level: newLevel, ...(levelBonus > 0 ? { balance: { increment: levelBonus } } : {}) } });
      if (levelBonus > 0) await tx.transaction.create({ data: { userId, type: "levelup_bonus", amount: levelBonus, balance: userRecord.balance, reference: `level_${newLevel}` } });
      await tx.bet.update({ where: { id: betId }, data: { payout: actualPayout, multiplier: bet.amount > 0 ? parseFloat((actualPayout / bet.amount).toFixed(4)) : 0, result: actualPayout > 0 ? "win" : "loss", state: JSON.stringify({ ...state, revealed: true }) } });
      return { payout: actualPayout, balance: userRecord.balance, level: userRecord.level, xp: userRecord.xp, leveledUp: didLevelUp };
    });
    res.json({ grid: state.grid, wonPrize, payout, payoutChips: wonPrize.chips, balance, level, xp, leveledUp, revealed: true });
  } catch (err) { console.error("Scratch reveal error:", err); res.status(500).json({ error: "Something went wrong — please try again" }); }
});
