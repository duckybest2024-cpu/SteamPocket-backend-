import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { config } from "./lib/config";
import { CrashEngine } from "./sockets/crashEngine";
import { CoinflipEngine } from "./sockets/coinflipEngine";
import { JackpotEngine } from "./sockets/jackpotEngine";
import { HorseRaceEngine } from "./sockets/horseRaceEngine";
import { attachBattleDice, attachRPS, attachRaffle, attachBingo, attachTower, attachMultiRoulette, attachPoker } from "./sockets/multiplayerGamesEngine";
import { attachBoardGames } from "./sockets/boardGamesEngine";
import { ChatEngine } from "./sockets/chatEngine";

process.on("uncaughtException", (err) => {
  console.error("FATAL uncaughtException (continuing):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("FATAL unhandledRejection (continuing):", reason);
});

import { prisma } from "./lib/prisma";

async function waitForDb(retries = 10): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log("✅ Database connected");
      return;
    } catch {
      console.log(`⏳ Waiting for database... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error("❌ Could not connect to database — starting anyway");
}

(async () => {
  await waitForDb();

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  new CrashEngine(io);
  new CoinflipEngine(io);
  new JackpotEngine(io);
  new HorseRaceEngine(io);
  attachBattleDice(io);
  attachRPS(io);
  attachRaffle(io);
  attachBingo(io);
  attachTower(io);
  attachMultiRoulette(io);
  attachPoker(io);
  attachBoardGames(io);
  new ChatEngine(io);

  httpServer.listen(config.port, () => {
    console.log(`🎰 GrilledCoin listening on :${config.port}`);
    console.log(`   REST API:   http://localhost:${config.port}`);
    console.log(`   Crash feed: ws://localhost:${config.port}/crash`);
  });
})();
