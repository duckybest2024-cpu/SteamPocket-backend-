import { config } from "./config";
import { getSiteConfig } from "./siteConfig";

/**
 * Global house-edge control for the engine-driven games (Dice, Crash, Limbo,
 * Mines, Hi-Lo). These read `config.houseEdge` live at spin-time, so updating
 * that value here changes the odds for everyone immediately — it is a uniform,
 * global RTP knob, NOT a per-player or per-outcome override.
 *
 * Stored as a percent in SiteConfig key "house_edge" (e.g. "1" = 1% edge /
 * 99% RTP). Negative values mean players profit on average (the house pays out
 * more than it takes in) — fine for a play-money game, but it bleeds chips.
 */

const MIN_EDGE = -0.5; // players win ~50% more than they stake on average
const MAX_EDGE = 0.95; // brutal — house keeps almost everything

/** Clamp a fractional edge (e.g. 0.01) into the allowed range. */
export function clampEdge(edge: number): number {
  if (!Number.isFinite(edge)) return config.houseEdge;
  return Math.max(MIN_EDGE, Math.min(MAX_EDGE, edge));
}

/** Set the live global house edge from a PERCENT value (e.g. 1 → 0.01). */
export function setHouseEdgePercent(percent: number): number {
  const edge = clampEdge(percent / 100);
  config.houseEdge = edge;
  return edge;
}

/** Current global house edge expressed as a percent (e.g. 0.01 → 1). */
export function getHouseEdgePercent(): number {
  return Math.round(config.houseEdge * 10000) / 100;
}

/** Load the persisted house edge from SiteConfig into the live config at boot. */
export async function loadHouseEdge(): Promise<void> {
  const stored = await getSiteConfig("house_edge");
  if (stored !== null && stored.trim() !== "") {
    const percent = Number(stored);
    if (Number.isFinite(percent)) config.houseEdge = clampEdge(percent / 100);
  }
  const lucky = await getSiteConfig("owner_lucky");
  config.ownerLucky = lucky === "true";
  const bias = await getSiteConfig("win_bias");
  if (bias !== null && bias.trim() !== "") {
    const pct = Number(bias);
    if (Number.isFinite(pct)) config.winBias = clampBias(pct / 100);
  }
}

/** Owner-only "lucky mode" — when on, the OWNER's own bets always win. */
export function setOwnerLucky(on: boolean): void {
  config.ownerLucky = on;
}

/** Clamp a fractional win bias to [-1, 1]. */
export function clampBias(b: number): number {
  if (!Number.isFinite(b)) return 0;
  return Math.max(-1, Math.min(1, b));
}

/** Set the global win-chance bias from a PERCENT (e.g. 30 -> 0.30 = +30% wins). */
export function setWinBiasPercent(percent: number): number {
  config.winBias = clampBias(percent / 100);
  return config.winBias;
}

export function getWinBiasPercent(): number {
  return Math.round(config.winBias * 100);
}
