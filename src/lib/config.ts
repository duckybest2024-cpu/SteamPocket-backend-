import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "grilledcoin-dev-secret-change-me",
  jwtExpiresIn: "7d" as const,
  startingBalance: 0, // no free chips — players must purchase
  houseEdge: 0.01, // 1% — applied uniformly across every game's RTP target (99%)
};
