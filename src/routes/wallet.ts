import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { applyLedgerEntry, updateHouseChips, InsufficientFundsError } from "../lib/wallet";
import { getStripe, CHIP_PACKAGES } from "../lib/stripe";
import { getSiteConfig } from "../lib/siteConfig";

async function configFlag(key: string, defaultValue: boolean): Promise<boolean> {
  const raw = await getSiteConfig(key);
  return raw === null ? defaultValue : raw !== "false";
}

async function configNumber(key: string, defaultValue: number): Promise<number> {
  const raw = await getSiteConfig(key);
  return raw === null ? defaultValue : Number(raw);
}

export const walletRouter = Router();

walletRouter.get("/transactions", requireAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where: { userId: req.userId! } }),
  ]);

  res.json({ items, page, pageSize, total });
});

// ---------------------------------------------------------------------------
// Stripe checkout — create a hosted payment session for a chip package
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({ packageId: z.string() });

walletRouter.post("/create-checkout-session", requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!(await configFlag("stripeCheckoutEnabled", true))) {
      return res.status(503).json({ error: "Chip purchases are temporarily disabled." });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        error: "Payment not configured. Add STRIPE_SECRET_KEY to environment variables.",
      });
    }

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const pkg = CHIP_PACKAGES.find((p) => p.id === parsed.data.packageId);
    if (!pkg) return res.status(400).json({ error: "Invalid package" });

    const origin = `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${pkg.name} — ${pkg.chips} chips`,
              description: `${pkg.chips.toLocaleString()} GrilledCoin chips (play money). Use test card 4242 4242 4242 4242.`,
            },
            unit_amount: pkg.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      metadata: {
        userId: req.userId!,
        packageId: pkg.id,
        chips: String(pkg.chips),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session — please try again" });
  }
});

// ---------------------------------------------------------------------------
// Chip system: cash out chips to bank, buy chips from bank
// ---------------------------------------------------------------------------

const buyChipsSchema = z.object({ amount: z.number().int().min(100) });

walletRouter.post("/buy-chips", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = buyChipsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const userId = req.userId!;
    const { amount } = parsed.data;

    const minBuyChips = await configNumber("minBuyChips", 1);
    if (amount < minBuyChips * 100) {
      return res.status(400).json({ error: `Minimum purchase is ${minBuyChips} chip${minBuyChips === 1 ? "" : "s"}` });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.bank < amount) return res.status(400).json({ error: "Not enough chips in your bank" });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { bank: { decrement: amount }, balance: { increment: amount } },
      });
      await tx.transaction.create({
        data: { userId, type: "deposit", amount, balance: u.balance, reference: "buy_chips" },
      });
      return u;
    });

    // Moving from player bank → playing chips: house loses chips, gains dollars
    void updateHouseChips(-amount, amount);

    res.json({ balance: updated.balance, bank: updated.bank });
  } catch (err) {
    console.error("Buy chips error:", err);
    res.status(500).json({ error: "Transaction failed — please try again" });
  }
});

const cashoutSchema = z.object({ amount: z.number().int().positive().optional() });

walletRouter.post("/cashout-chips", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const parsed = cashoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const userId = req.userId!;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.balance <= 0) return res.status(400).json({ error: "No chips to cash out" });

    const minCashoutChips = await configNumber("minCashoutChips", 50);
    const MIN_CASHOUT_CENTS = minCashoutChips * 100;
    if (user.balance < MIN_CASHOUT_CENTS) {
      return res.status(400).json({ error: `Minimum cashout is ${minCashoutChips} chips (you have ${Math.floor(user.balance / 100)})` });
    }

    const requestedAmount = parsed.data.amount;
    let amount = requestedAmount ? Math.min(requestedAmount, user.balance) : user.balance;

    const maxDailyCashoutChips = await configNumber("maxDailyCashoutChips", 0); // 0 = unlimited
    if (maxDailyCashoutChips > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const withdrawnToday = await prisma.transaction.aggregate({
        where: { userId, type: "withdrawal", createdAt: { gt: since } },
        _sum: { amount: true },
      });
      const alreadyWithdrawn = Math.abs(withdrawnToday._sum.amount ?? 0);
      const remainingCap = maxDailyCashoutChips * 100 - alreadyWithdrawn;
      if (remainingCap <= 0) {
        return res.status(400).json({ error: `Daily cashout limit reached (${maxDailyCashoutChips} chips per 24h)` });
      }
      amount = Math.min(amount, remainingCap);
    }

    if (amount < MIN_CASHOUT_CENTS) return res.status(400).json({ error: `Minimum cashout is ${minCashoutChips} chips` });

    const withdrawalFeePercent = await configNumber("withdrawalFeePercent", 0);
    const fee = Math.floor((amount * withdrawalFeePercent) / 100);
    const netAmount = amount - fee;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount }, bank: { increment: netAmount } },
      });
      await tx.transaction.create({
        data: { userId, type: "withdrawal", amount: -amount, balance: u.balance, reference: "cashout_chips" },
      });
      return u;
    });

    // Moving from playing chips → player bank: house gains chips, loses only the net dollar payout (keeps the fee)
    void updateHouseChips(amount, -netAmount);

    res.json({ balance: updated.balance, bank: updated.bank, cashedOut: netAmount, fee });
  } catch (err) {
    console.error("Cashout chips error:", err);
    res.status(500).json({ error: "Transaction failed — please try again" });
  }
});

/** Daily rakeback: 5% of cumulative wagers since the last claim, paid as a flat bonus. */
walletRouter.post("/rakeback/claim", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await configFlag("rakebackEnabled", true))) {
    return res.status(503).json({ error: "Rakeback is currently disabled." });
  }

  const userId = req.userId!;

  const lastClaim = await prisma.rakebackClaim.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  const since = lastClaim?.createdAt ?? new Date(0);

  const rakebackCooldownHours = await configNumber("rakebackCooldownHours", 24);
  const cooldownMs = rakebackCooldownHours * 60 * 60 * 1000;
  if (lastClaim && Date.now() - lastClaim.createdAt.getTime() < cooldownMs) {
    const retryAfterMs = cooldownMs - (Date.now() - lastClaim.createdAt.getTime());
    return res.status(429).json({ error: `Rakeback can be claimed once every ${rakebackCooldownHours} hours`, retryAfterMs });
  }

  const wagered = await prisma.bet.aggregate({
    where: { userId, createdAt: { gt: since } },
    _sum: { amount: true },
  });
  const totalWagered = wagered._sum.amount ?? 0;
  const rakebackPercent = await configNumber("rakebackPercent", 5);
  const rakeback = Math.floor(totalWagered * (rakebackPercent / 100));

  if (rakeback <= 0) return res.status(400).json({ error: "No eligible wagers since your last claim" });

  const claim = await prisma.rakebackClaim.create({ data: { userId, amount: rakeback } });
  const updated = await applyLedgerEntry(prisma, userId, "rakeback", rakeback, claim.id);

  res.json({ claimed: rakeback, balance: updated.balance });
});

/** Top wagered / top won leaderboards over a rolling 7-day window. */
walletRouter.get("/leaderboard", async (req, res) => {
  if (!(await configFlag("leaderboardEnabled", true))) {
    return res.status(503).json({ error: "Leaderboard is currently disabled." });
  }

  const metric = req.query.metric === "profit" ? "profit" : "wagered";
  const windowDays = await configNumber("leaderboardWindowDays", 7);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const grouped = await prisma.bet.groupBy({
    by: ["userId"],
    where: { createdAt: { gt: since } },
    _sum: { amount: true, payout: true },
    _count: { _all: true },
  });

  const ranked = grouped
    .map((row) => ({
      userId: row.userId,
      wagered: row._sum.amount ?? 0,
      won: row._sum.payout ?? 0,
      profit: (row._sum.payout ?? 0) - (row._sum.amount ?? 0),
      bets: row._count._all,
    }))
    .sort((a, b) => (metric === "profit" ? b.profit - a.profit : b.wagered - a.wagered))
    .slice(0, 20);

  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((r) => r.userId) } },
    select: { id: true, username: true, level: true },
  });
  const userMap = new Map<string, any>(users.map((u) => [u.id, u]));

  res.json({
    metric,
    windowDays,
    leaderboard: ranked.map((r, i) => ({
      rank: i + 1,
      username: userMap.get(r.userId)?.username ?? "unknown",
      level: userMap.get(r.userId)?.level ?? 1,
      ...r,
      userId: undefined,
    })),
  });
});

// Promo code redemption
walletRouter.post("/promo/redeem", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await configFlag("promoRedeemEnabled", true))) {
    return res.status(503).json({ error: "Promo code redemption is currently disabled." });
  }
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: "Code required" });
  try {
    const promo = await prisma.promoCode.findFirst({ where: { code: code.toUpperCase().trim(), active: true } });
    if (!promo) return res.status(404).json({ error: "Invalid or expired promo code" });
    if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ error: "This promo code has expired" });
    if (promo.uses >= promo.maxUses) return res.status(400).json({ error: "This promo code has been fully redeemed" });
    const existing = await prisma.promoRedemption.findFirst({ where: { promoCodeId: promo.id, userId: req.userId! } });
    if (existing) return res.status(400).json({ error: "You've already used this promo code" });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.promoCode.update({ where: { id: promo.id }, data: { uses: { increment: 1 } } });
      await tx.promoRedemption.create({ data: { promoCodeId: promo.id, userId: req.userId! } });
      const u = await tx.user.update({ where: { id: req.userId! }, data: { balance: { increment: promo.chips } } });
      await tx.transaction.create({ data: { userId: req.userId!, type: "promo", amount: promo.chips, balance: u.balance, reference: promo.code } });
      return u;
    });
    res.json({ chips: promo.chips, balance: updated.balance, message: `Redeemed! ${Math.floor(promo.chips / 100)} chips added.` });
  } catch (err) { res.status(500).json({ error: "Failed to redeem code" }); }
});

// ---------------------------------------------------------------------------
// Daily Login Bonus
// ---------------------------------------------------------------------------

const dailyBonusClaimed = new Map<string, string>(); // userId -> ISO date (YYYY-MM-DD)

walletRouter.post("/daily-bonus", requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!(await configFlag("dailyBonusEnabled", true))) {
      return res.status(503).json({ error: "The daily bonus is currently disabled." });
    }

    const userId = req.userId!;
    const today = new Date().toISOString().slice(0, 10);
    if (dailyBonusClaimed.get(userId) === today) {
      return res.status(400).json({ error: "Already claimed today's bonus" });
    }
    const dailyBonusChips = await configNumber("dailyBonusChips", 50);
    const chipsToAward = dailyBonusChips * 100;
    await applyLedgerEntry(prisma, userId, "daily_bonus", chipsToAward);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
    dailyBonusClaimed.set(userId, today);
    return res.json({ chips: dailyBonusChips, streak: 1, balance: user?.balance ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: "Failed to claim daily bonus" });
  }
});

walletRouter.use((err: unknown, _req: unknown, res: import("express").Response, next: import("express").NextFunction) => {
  if (err instanceof InsufficientFundsError) return res.status(400).json({ error: err.message });
  next(err);
});
