import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { applyLedgerEntry } from "../lib/wallet";
import { NFT_CATALOG } from "../lib/nftCatalog";
import { CASES } from "../lib/cases";

export const casesRouter = Router();

// GET /cases — public
casesRouter.get("/", async (_req, res: Response) => {
  try {
    res.json({ cases: CASES });
  } catch (err) {
    console.error("GET /cases error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /cases/history — requireAuth (must be before /:caseId to avoid shadowing)
casesRouter.get("/history", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const openings = await prisma.caseOpening.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    // Enrich with NFT details
    const nftIds = openings.map((o) => o.nftId);
    const nfts = nftIds.length
      ? await prisma.nft.findMany({ where: { id: { in: nftIds } }, select: { id: true, name: true, rarity: true, emoji: true } })
      : [];
    const nftMap = new Map<string, any>(nfts.map((n) => [n.id, n]));
    const enriched = openings.map((o) => ({ ...o, ...nftMap.get(o.nftId) }));
    res.json({ openings: enriched });
  } catch (err) {
    console.error("GET /cases/history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /cases/:caseId — public
casesRouter.get("/:caseId", async (req, res: Response) => {
  try {
    const { caseId } = req.params;
    const caseDef = CASES.find((c) => c.id === caseId);
    if (!caseDef) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const recentOpenings = await prisma.caseOpening.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const nftIds = recentOpenings.map((o) => o.nftId);
    const nfts = nftIds.length
      ? await prisma.nft.findMany({ where: { id: { in: nftIds } }, select: { id: true, name: true, rarity: true, emoji: true } })
      : [];
    const nftMap = new Map<string, any>(nfts.map((n) => [n.id, n]));
    const enriched = recentOpenings.map((o) => ({ ...o, nft: nftMap.get(o.nftId) ?? null }));

    res.json({ case: caseDef, recentOpenings: enriched });
  } catch (err) {
    console.error("GET /cases/:caseId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /cases/:caseId/open — requireAuth
casesRouter.post("/:caseId/open", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const userId = req.userId!;

    // 1. Find case
    const caseDef = CASES.find((c) => c.id === caseId);
    if (!caseDef) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    // 2. Charge user balance
    try {
      await applyLedgerEntry(prisma, userId, "case_open", -(caseDef.priceChips * 100), caseId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "INSUFFICIENT_BALANCE" || message.includes("INSUFFICIENT_BALANCE")) {
        res.status(400).json({ error: "Insufficient balance" });
        return;
      }
      throw err;
    }

    // 3. Determine drop rarity via weighted random
    const dropTable = caseDef.dropTable as unknown as Record<string, number>;
    const rarities = Object.keys(dropTable);
    const totalWeight = rarities.reduce((sum, r) => sum + (dropTable[r] ?? 0), 0);
    let rand = Math.random() * totalWeight;
    let chosenRarity = rarities[0];
    for (const rarity of rarities) {
      rand -= dropTable[rarity] ?? 0;
      if (rand <= 0) {
        chosenRarity = rarity;
        break;
      }
    }

    // 4. Get candidate NFTs filtered by rarity (and optionally collectionFilter)
    let candidates = NFT_CATALOG.filter((nft) => nft.rarity === chosenRarity);
    if (caseDef.collectionFilter !== null) {
      candidates = candidates.filter((nft) =>
        (caseDef.collectionFilter as string[]).includes(nft.collectionId)
      );
    }

    // Fallback if no candidates at chosen rarity
    if (candidates.length === 0) {
      candidates = NFT_CATALOG.filter((nft) => nft.rarity === "common");
    }

    // 5. Filter out exhausted limited-supply NFTs
    const limitedIds = candidates
      .filter((nft) => nft.supply !== -1)
      .map((nft) => nft.id);

    let exhaustedIds = new Set<string>();
    if (limitedIds.length > 0) {
      const supplyRecords = await prisma.nftSupply.findMany({
        where: { templateId: { in: limitedIds } },
      });
      for (const record of supplyRecords) {
        const template = candidates.find((c) => c.id === record.templateId);
        if (template && template.supply !== -1 && record.minted >= template.supply) {
          exhaustedIds.add(record.templateId);
        }
      }
    }

    const available = candidates.filter((nft) => !exhaustedIds.has(nft.id));
    const pool = available.length > 0 ? available : candidates;

    // 6. Pick a random NFT
    const template = pool[Math.floor(Math.random() * pool.length)];

    // 7. If limited supply, increment minted inside a transaction
    if (template.supply !== -1) {
      await prisma.$transaction(async (tx) => {
        await tx.nftSupply.upsert({
          where: { templateId: template.id },
          update: { minted: { increment: 1 } },
          create: { templateId: template.id, minted: 1 },
        });
      });
    }

    // 8 & 9. Create Nft and CaseOpening records
    const [nft] = await prisma.$transaction([
      prisma.nft.create({
        data: {
          ownerId: userId,
          name: template.name,
          description: JSON.stringify({
            desc: template.description,
            templateId: template.id,
            power: template.power,
          }),
          rarity: template.rarity,
          category: template.collectionId,
          emoji: template.emoji,
        },
      }),
    ]);

    await prisma.caseOpening.create({
      data: {
        userId,
        caseId,
        nftId: nft.id,
        rarity: template.rarity,
        paidChips: caseDef.priceChips,
      },
    });

    // 10. Get updated user balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    const balance = (user?.balance ?? 0) / 100;

    // 11. Return result
    res.json({ nft, template, balance, rarity: template.rarity });
  } catch (err) {
    console.error("POST /cases/:caseId/open error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
