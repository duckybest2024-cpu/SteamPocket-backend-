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
import { payoutRouter } from "./routes/payout";
import { vipRouter } from "./routes/vip";
import { nftRouter } from "./routes/nfts";
import { nftMarketRouter } from "./routes/nftmarket";
import { casesRouter } from "./routes/cases";
import { arcadeRouter } from "./routes/arcade";
import { scratchRouter } from "./routes/scratch";
import { eventsRouter } from "./routes/events";
import { statsRouter } from "./routes/stats";
import { prisma } from "./lib/prisma";

export function createApp() {
  const app = express();

  // Trust Railway's reverse proxy so req.protocol returns "https" correctly
  app.set("trust proxy", 1);

  app.use(cors());

  // Stripe webhook must receive the raw body — register before express.json()
  app.post("/wallet/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

  app.use(express.json());

  app.get("/health", async (_req, res) => {
    let dbOk = false;
    let dbError = "";
    try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch (e: any) { dbError = e?.message ?? String(e); }
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, name: "grilledcoin", time: new Date().toISOString(), db: dbOk ? "connected" : "ERROR: " + dbError });
  });

  // The playable web UI — a static single-page app that talks to the API below.
  // HTML/JS/CSS are served with no-cache so every deploy reaches players
  // immediately (otherwise browsers keep serving the old cached app.js/admin.js
  // and new features/fixes appear "missing"). Images/fonts stay cached.
  app.use(express.static(path.join(__dirname, "..", "public"), {
    setHeaders: (res, filePath) => {
      if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  }));

  app.use("/auth", authRouter);
  app.use("/settings", settingsRouter);
  app.use("/payout", payoutRouter);
  app.use("/vip", vipRouter);
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
