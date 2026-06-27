import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "grilledcoin-dev-secret-change-me",
  jwtExpiresIn: "7d" as const,
  startingBalance: 1000 * 100, // every new player starts with 1000 free chips
  houseEdge: 0.01, // 1% — applied uniformly across every game's RTP target (99%)
  ownerLucky: false, // owner-only "lucky mode": the owner's own bets always win
  // Global win-chance bias, -1..1. >0 = players win MORE often (that fraction of
  // losses flip to wins); <0 = players win LESS often (that fraction of wins flip
  // to losses); 0 = fair odds.
  winBias: 0,
};
