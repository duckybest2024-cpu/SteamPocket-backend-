import express from "express";
import cors from "cors";
import path from "path";
import { authRouter } from "./routes/auth";
import { fairnessRouter } from "./routes/fairness";
import { walletRouter } from "./routes/wallet";
import { betsRouter } from "./routes/bets";
import { instantGamesRouter } from "./routes/games/instantGames";
import { minesRouter } from "./routes/games/mines";
import { blackjackRouter } from "./routes/games/blackjack";
import { rouletteRouter } from "./routes/games/roulette";
import { slotsRouter } from "./routes/games/slots";
import { hiloRouter } from "./routes/games/hilo";
import { videoPokerRouter } from "./routes/games/videopoker";
import { stripeWebhookHandler } from "./routes/stripeWebhook";
import { leaderboardRouter } from "./routes/leaderboard";
import { friendsRouter } from "./routes/friends";
import { adminRouter } from "./routes/admin";
import { settingsRouter } from "./routes/settings";
import { nftRouter } from "./routes/nfts";
import { nftMarketRouter } from "./routes/nftmarket";
import { casesRouter } from "./routes/cases";
import { arcadeRouter } from "./routes/arcade";
import { scratchRouter } from "./routes/scratch";
import { eventsRouter } from "./routes/events";
import { statsRouter } from "./routes/stats";
import { prisma } from "./lib/prisma";
import { getLiqpayKeys, verifyLiqpayCallback, liqpayDecode } from "./lib/liqpay";
import { CHIP_PACKAGES } from "./lib/stripe";
import { applyLedgerEntry } from "./lib/wallet";

export function createApp() {
  const app = express();

  // Trust Railway's reverse proxy so req.protocol returns "https" correctly
  app.set("trust proxy", 1);

  app.use(cors());

  // Stripe webhook must receive the raw body — register before express.json()
  app.post("/wallet/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

  // LiqPay callback — receives application/x-www-form-urlencoded, must be before express.json()
  app.post("/wallet/liqpay-callback", express.urlencoded({ extended: false }), async (req, res) => {
    const keys = getLiqpayKeys();
    if (!keys) { console.error("LiqPay callback: keys not configured"); return res.status(503).send("not configured"); }

    const { data, signature } = req.body as { data?: string; signature?: string };
    if (!data || !signature) return res.status(400).send("missing params");

    if (!verifyLiqpayCallback(keys.privateKey, data, signature)) {
      console.error("LiqPay callback: invalid signature");
      return res.status(400).send("invalid signature");
    }

    const payload = liqpayDecode(data) as Record<string, string>;
    console.log("LiqPay callback status:", payload.status, "order:", payload.order_id);

    if (payload.status === "success" || payload.status === "sandbox") {
      // order_id format: userId_packageId_timestamp  (no underscores in cuid or package ids)
      const parts = String(payload.order_id).split("_");
      const userId = parts[0];
      const packageId = parts[1];
      const pkg = CHIP_PACKAGES.find((p) => p.id === packageId);

      if (!userId || !pkg) {
        console.error("LiqPay callback: cannot parse order_id", payload.order_id);
        return res.status(400).send("invalid order");
      }

      // Idempotency: skip if this payment_id was already processed
      const ref = `liqpay_${payload.payment_id}`;
      const exists = await prisma.transaction.findFirst({ where: { reference: ref } });
      if (exists) { console.log("LiqPay callback: duplicate, skipping", ref); return res.send("ok"); }

      try {
        const chips = pkg.chips * 100; // chips in cents
        await applyLedgerEntry(prisma, userId, "deposit", chips, ref);
        console.log(`LiqPay: credited ${pkg.chips} chips to ${userId} (${ref})`);
      } catch (err) {
        console.error("LiqPay: failed to credit chips:", err);
        return res.status(500).send("credit failed");
      }
    }

    res.send("ok");
  });

  app.use(express.json());

  app.get("/health", async (_req, res) => {
    let dbOk = false;
    let dbError = "";
    try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch (e: any) { dbError = e?.message ?? String(e); }
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, name: "grilledcoin", time: new Date().toISOString(), db: dbOk ? "connected" : "ERROR: " + dbError });
  });

  // The playable web UI — a static single-page app that talks to the API below.
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use("/auth", authRouter);
  app.use("/settings", settingsRouter);
  app.use("/fairness", fairnessRouter);
  app.use("/wallet", walletRouter);
  app.use("/bets", betsRouter);

  app.use("/games", instantGamesRouter); // /games/dice, /games/limbo, /games/plinko
  app.use("/games/mines", minesRouter);
  app.use("/games/blackjack", blackjackRouter);
  app.use("/games/roulette", rouletteRouter);
  app.use("/games/slots", slotsRouter);
  app.use("/games/hilo", hiloRouter);
  app.use("/games/videopoker", videoPokerRouter);

  app.use("/leaderboard", leaderboardRouter);
  app.use("/stats", statsRouter);
  app.use("/friends", friendsRouter);
  app.use("/admin", adminRouter);
  app.use("/nfts", nftRouter);
  app.use("/nftmarket", nftMarketRouter);
  app.use("/cases", casesRouter);
  app.use("/arcade", arcadeRouter);
  app.use("/scratch", scratchRouter);
  app.use("/events", eventsRouter);

  // Public site config + active broadcasts
  app.get("/config", async (_req, res) => {
    try {
      const configs = await prisma.siteConfig.findMany();
      const obj: Record<string, string> = {};
      for (const c of configs) obj[c.key] = c.value;
      res.json(obj);
    } catch { res.json({}); }
  });

  app.get("/broadcasts", async (_req, res) => {
    try {
      const broadcasts = await prisma.broadcast.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 5 });
      res.json({ broadcasts });
    } catch { res.json({ broadcasts: [] }); }
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
