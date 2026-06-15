import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { applyLedgerEntry } from "../lib/wallet";
import { NFT_CATALOG } from "../lib/nftCatalog";

export const nftMarketRouter = Router();

const RARITY_ORDER: Record<string, number> = { unique: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };

function buildTemplateWithRemaining(templates: typeof NFT_CATALOG, supplyMap: Map<string, number>) {
  return templates.map((t) => {
    const minted = supplyMap.get(t.id) ?? 0;
    const remaining = t.supply === -1 ? -1 : t.supply - minted;
    return { ...t, remaining };
  });
}

function sortTemplates(templates: ReturnType<typeof buildTemplateWithRemaining>) {
  return [...templates].sort((a, b) => {
    const rarityDiff = (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99);
    if (rarityDiff !== 0) return rarityDiff;
    return b.priceChips - a.priceChips;
  });
}

nftMarketRouter.get("/catalog", async (_req, res: Response) => {
  try {
    const limitedIds = NFT_CATALOG.filter((t) => t.supply !== -1).map((t) => t.id);
    const supplyRecords = await prisma.nftSupply.findMany({ where: { templateId: { in: limitedIds } } });
    const supplyMap = new Map(supplyRecords.map((r) => [r.templateId, r.minted]));
    res.json({ templates: sortTemplates(buildTemplateWithRemaining(NFT_CATALOG, supplyMap)) });
  } catch (err) {
    console.error("GET /nftmarket/catalog error:", err);
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

nftMarketRouter.get("/catalog/:collectionId", async (req, res: Response) => {
  try {
    const filtered = NFT_CATALOG.filter((t) => t.collectionId === req.params.collectionId);
    if (filtered.length === 0) return res.status(404).json({ error: "Collection not found" });
    const limitedIds = filtered.filter((t) => t.supply !== -1).map((t) => t.id);
    const supplyRecords = await prisma.nftSupply.findMany({ where: { templateId: { in: limitedIds } } });
    const supplyMap = new Map(supplyRecords.map((r) => [r.templateId, r.minted]));
    res.json({ templates: sortTemplates(buildTemplateWithRemaining(filtered, supplyMap)) });
  } catch (err) {
    console.error("GET /nftmarket/catalog/:collectionId error:", err);
    res.status(500).json({ error: "Failed to fetch collection" });
  }
});

nftMarketRouter.post("/buy", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = z.object({ templateId: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "templateId is required" });

  const { templateId } = parsed.data;
  const userId = req.userId!;
  const template = NFT_CATALOG.find((t) => t.id === templateId);
  if (!template) return res.status(404).json({ error: "Template not found in catalog" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (template.supply !== -1) {
        const existing = await tx.nftSupply.findUnique({ where: { templateId } });
        if ((existing?.minted ?? 0) >= template.supply) throw new Error("SOLD_OUT");
        await tx.nftSupply.upsert({ where: { templateId }, update: { minted: { increment: 1 } }, create: { templateId, minted: 1 } });
      }
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_NOT_FOUND");
      const priceInCents = template.priceChips * 100;
      if (user.balance < priceInCents) throw new Error("INSUFFICIENT_BALANCE");
      const nft = await tx.nft.create({
        data: {
          ownerId: userId, name: template.name,
          description: JSON.stringify({ desc: template.description, templateId: template.id, power: template.power }),
          rarity: template.rarity, category: template.collectionId, emoji: template.emoji,
        },
      });
      return { nft, priceInCents };
    });
    await applyLedgerEntry(prisma, userId, "nft_purchase", -(result.priceInCents), result.nft.id);
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    return res.json({ nft: result.nft, balance: (updatedUser?.balance ?? 0) / 100 });
  } catch (err: any) {
    if (err.message === "SOLD_OUT") return res.status(409).json({ error: "This NFT is sold out" });
    if (err.message === "INSUFFICIENT_BALANCE") return res.status(400).json({ error: "Insufficient chip balance" });
    if (err.message === "USER_NOT_FOUND") return res.status(404).json({ error: "User not found" });
    console.error("POST /nftmarket/buy error:", err);
    return res.status(500).json({ error: "Failed to purchase NFT" });
  }
});

nftMarketRouter.post("/use/:nftId", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { nftId } = req.params;
  const userId = req.userId!;
  try {
    const nft = await prisma.nft.findUnique({ where: { id: nftId } });
    if (!nft) return res.status(404).json({ error: "NFT not found" });
    if (nft.ownerId !== userId) return res.status(403).json({ error: "You do not own this NFT" });
    if (nft.category.endsWith("_used")) return res.status(400).json({ error: "This NFT power has already been used" });

    let parsedDesc: { desc: string; templateId: string; power: any } | null = null;
    try { parsedDesc = JSON.parse(nft.description); } catch { return res.status(400).json({ error: "NFT description is not parseable" }); }
    if (!parsedDesc?.templateId) return res.status(400).json({ error: "NFT has no templateId in description" });

    const template = NFT_CATALOG.find((t) => t.id === parsedDesc!.templateId);
    if (!template || !template.power) return res.status(400).json({ error: "This NFT has no power to activate" });

    const { power } = template;
    let effectDescription = "";
    let balance: number | undefined;

    switch (power.type) {
      case "chips_bonus": { await applyLedgerEntry(prisma, userId, "nft_power", power.value * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `+${power.value} chips awarded`; break; }
      case "xp_bonus": { const u = await prisma.user.findUnique({ where: { id: userId } }); if (!u) return res.status(404).json({ error: "User not found" }); const nx = ((u as any).xp ?? 0) + power.value; const nl = Math.max((u as any).level ?? 1, Math.floor(nx / 1000) + 1); await prisma.user.update({ where: { id: userId }, data: { ...(("xp" in u) ? { xp: nx } : {}), ...(("level" in u) ? { level: nl } : {}) } as any }); balance = u.balance / 100; effectDescription = `+${power.value} XP awarded`; break; }
      case "jackpot_entry": { effectDescription = "Jackpot entry registered"; const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; break; }
      case "free_spin": { await applyLedgerEntry(prisma, userId, "nft_power", power.value * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `Free spin bonus: +${power.value} chips`; break; }
      case "multiplier_boost": { await applyLedgerEntry(prisma, userId, "nft_power", power.value * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `Multiplier boost applied: +${power.value} chips`; break; }
      case "cashback": { await applyLedgerEntry(prisma, userId, "nft_power", power.value * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `Cashback activated: +${power.value} chips refunded`; break; }
      case "bank_bonus": { await prisma.user.update({ where: { id: userId }, data: { bank: { increment: power.value * 100 } } }); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `Bank bonus: +${power.value} chips added to your bank`; break; }
      case "double_chips": { await applyLedgerEntry(prisma, userId, "nft_power", power.value * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `Double chips boost: +${power.value} chips`; break; }
      case "lucky_draw": { const min = Math.floor(power.value / 2); const max = power.value * 2; const prize = min + Math.floor(Math.random() * (max - min + 1)); await applyLedgerEntry(prisma, userId, "nft_power", prize * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `Lucky draw! You won ${prize} chips (range: ${min}–${max})`; break; }
      case "vip_chips": { await applyLedgerEntry(prisma, userId, "nft_power", power.value * 100, nftId); const u = await prisma.user.findUnique({ where: { id: userId } }); balance = (u?.balance ?? 0) / 100; effectDescription = `VIP reward: +${power.value} chips added`; break; }
      default: return res.status(400).json({ error: "Unknown power type" });
    }

    await prisma.nft.update({ where: { id: nftId }, data: { category: `${nft.category}_used` } });
    const response: Record<string, any> = { success: true, effect: effectDescription, balance, power: power.type };
    if (power.type === "jackpot_entry") response.note = "Show this to admin to enter jackpot";
    return res.json(response);
  } catch (err) {
    console.error("POST /nftmarket/use/:nftId error:", err);
    return res.status(500).json({ error: "Failed to use NFT power" });
  }
});

nftMarketRouter.get("/search", async (req, res: Response) => {
  try {
    const { q, rarity, collection, minPrice, maxPrice, hasPower } = req.query;
    let results = [...NFT_CATALOG];
    if (q && typeof q === "string" && q.trim()) { const ql = q.toLowerCase(); results = results.filter((t) => t.name.toLowerCase().includes(ql) || t.description.toLowerCase().includes(ql) || t.collection.toLowerCase().includes(ql) || t.tags.some((tag) => tag.toLowerCase().includes(ql))); }
    if (rarity && typeof rarity === "string" && rarity !== "all") results = results.filter((t) => t.rarity === rarity);
    if (collection && typeof collection === "string" && collection !== "all") results = results.filter((t) => t.collectionId === collection);
    if (minPrice && typeof minPrice === "string") { const min = parseFloat(minPrice); if (!isNaN(min)) results = results.filter((t) => t.priceChips >= min); }
    if (maxPrice && typeof maxPrice === "string") { const max = parseFloat(maxPrice); if (!isNaN(max)) results = results.filter((t) => t.priceChips <= max); }
    if (hasPower === "true") results = results.filter((t) => t.power !== null);
    const limitedIds = results.filter((t) => t.supply !== -1).map((t) => t.id);
    const supplyRecords = limitedIds.length ? await prisma.nftSupply.findMany({ where: { templateId: { in: limitedIds } } }) : [];
    const supplyMap = new Map(supplyRecords.map((r) => [r.templateId, r.minted]));
    const sorted = sortTemplates(buildTemplateWithRemaining(results, supplyMap));
    res.json({ templates: sorted, total: sorted.length });
  } catch (err) { console.error("GET /nftmarket/search error:", err); res.status(500).json({ error: "Search failed" }); }
});

nftMarketRouter.post("/sell/:nftId", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { nftId } = req.params;
  const userId = req.userId!;
  try {
    const nft = await prisma.nft.findUnique({ where: { id: nftId } });
    if (!nft) return res.status(404).json({ error: "NFT not found" });
    if (nft.ownerId !== userId) return res.status(403).json({ error: "You do not own this NFT" });
    const listing = await (prisma as any).nftListing?.findUnique?.({ where: { nftId } }).catch(() => null);
    if (listing?.status === "active") return res.status(400).json({ error: "Cancel your marketplace listing before selling" });
    let payoutChips = 1;
    try { const desc = JSON.parse(nft.description); const template = NFT_CATALOG.find((t) => t.id === desc.templateId); if (template) payoutChips = Math.max(1, Math.floor(template.priceChips * 0.5)); } catch { /* default */ }
    await prisma.$transaction(async (tx) => { await tx.nft.delete({ where: { id: nftId } }); await tx.tradeOfferItem.deleteMany({ where: { nftId } }); });
    await applyLedgerEntry(prisma, userId, "nft_sell", payoutChips * 100, nftId);
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    return res.json({ success: true, payoutChips, balance: (updatedUser?.balance ?? 0) / 100 });
  } catch (err) { console.error("POST /nftmarket/sell/:nftId error:", err); return res.status(500).json({ error: "Failed to sell NFT" }); }
});

nftMarketRouter.get("/listings", async (_req, res: Response) => {
  try {
    const listings = await (prisma as any).nftListing.findMany({ where: { status: "active" }, orderBy: { createdAt: "desc" }, take: 100 });
    const nftIds = listings.map((l: any) => l.nftId);
    const nfts = nftIds.length ? await prisma.nft.findMany({ where: { id: { in: nftIds } } }) : [];
    const nftMap = new Map(nfts.map((n) => [n.id, n]));
    res.json({ listings: listings.map((l: any) => ({ ...l, nft: nftMap.get(l.nftId) ?? null })) });
  } catch (err) { console.error("GET /nftmarket/listings error:", err); res.status(500).json({ error: "Failed to fetch listings" }); }
});

nftMarketRouter.post("/list", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = z.object({ nftId: z.string(), priceChips: z.number().int().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "nftId and priceChips required" });
  const { nftId, priceChips } = parsed.data;
  const userId = req.userId!;
  try {
    const nft = await prisma.nft.findUnique({ where: { id: nftId } });
    if (!nft) return res.status(404).json({ error: "NFT not found" });
    if (nft.ownerId !== userId) return res.status(403).json({ error: "You do not own this NFT" });
    const existing = await (prisma as any).nftListing.findUnique({ where: { nftId } });
    if (existing?.status === "active") return res.status(409).json({ error: "Already listed" });
    const listing = await (prisma as any).nftListing.upsert({ where: { nftId }, update: { priceChips, status: "active", soldAt: null, buyerId: null }, create: { nftId, sellerId: userId, priceChips, status: "active" } });
    return res.json({ listing });
  } catch (err) { console.error("POST /nftmarket/list error:", err); return res.status(500).json({ error: "Failed to create listing" }); }
});

nftMarketRouter.delete("/list/:listingId", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { listingId } = req.params;
  const userId = req.userId!;
  try {
    const listing = await (prisma as any).nftListing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.sellerId !== userId) return res.status(403).json({ error: "Not your listing" });
    if (listing.status !== "active") return res.status(400).json({ error: "Listing is not active" });
    await (prisma as any).nftListing.update({ where: { id: listingId }, data: { status: "cancelled" } });
    return res.json({ success: true });
  } catch (err) { console.error("DELETE /nftmarket/list/:listingId error:", err); return res.status(500).json({ error: "Failed to cancel listing" }); }
});

nftMarketRouter.post("/buy-listing/:listingId", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { listingId } = req.params;
  const buyerId = req.userId!;
  try {
    const listing = await (prisma as any).nftListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "active") return res.status(404).json({ error: "Listing not found or already sold" });
    if (listing.sellerId === buyerId) return res.status(400).json({ error: "Cannot buy your own listing" });
    const nft = await prisma.nft.findUnique({ where: { id: listing.nftId } });
    if (!nft || nft.ownerId !== listing.sellerId) return res.status(409).json({ error: "NFT ownership changed" });
    const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer || buyer.balance < listing.priceChips * 100) return res.status(400).json({ error: "Insufficient balance" });
    await prisma.$transaction(async (tx) => {
      await tx.nft.update({ where: { id: listing.nftId }, data: { ownerId: buyerId } });
      await (tx as any).nftListing.update({ where: { id: listingId }, data: { status: "sold", buyerId, soldAt: new Date() } });
    });
    await applyLedgerEntry(prisma, buyerId, "nft_buy_p2p", -(listing.priceChips * 100), listingId);
    await applyLedgerEntry(prisma, listing.sellerId, "nft_sell_p2p", listing.priceChips * 100, listingId);
    const updatedUser = await prisma.user.findUnique({ where: { id: buyerId } });
    return res.json({ success: true, nft, balance: (updatedUser?.balance ?? 0) / 100 });
  } catch (err) { console.error("POST /nftmarket/buy-listing error:", err); return res.status(500).json({ error: "Failed to purchase listing" }); }
});
