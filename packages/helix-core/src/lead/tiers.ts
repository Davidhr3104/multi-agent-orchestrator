import type { LeadTier } from "../types";

/** Single source of truth for Helix for Leads hot / warm / cold bands. */
export const LEAD_TIER_THRESHOLDS = {
  hotMin: 75,
  warmMin: 50,
} as const;

export type LeadTierThresholds = typeof LEAD_TIER_THRESHOLDS;

export function tierFromScore(
  score: number,
  thresholds: LeadTierThresholds = LEAD_TIER_THRESHOLDS
): LeadTier {
  if (score >= thresholds.hotMin) return "hot";
  if (score >= thresholds.warmMin) return "warm";
  return "cold";
}

/** Shared labels so Scoring Rules and Automations never drift. */
export function leadTierBandCopy(thresholds: LeadTierThresholds = LEAD_TIER_THRESHOLDS) {
  const { hotMin, warmMin } = thresholds;
  return {
    scoringHint: `Hot ≥ ${hotMin}, warm ≥ ${warmMin}`,
    hotRule: `Hot (≥ ${hotMin})`,
    warmRule: `Warm (${warmMin}–${hotMin - 1})`,
    coldRule: `Cold (< ${warmMin})`,
    promptRule: `hot: score >= ${hotMin}, warm ${warmMin}-${hotMin - 1}, cold < ${warmMin}`,
  };
}
