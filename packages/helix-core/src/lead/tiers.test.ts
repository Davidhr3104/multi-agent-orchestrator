import { describe, expect, it } from "vitest";
import { planFollowUp } from "./intelligence";
import { LEAD_TIER_THRESHOLDS, leadTierBandCopy, tierFromScore } from "./tiers";

describe("lead tier thresholds", () => {
  it("maps scores with inclusive hot and warm floors", () => {
    expect(tierFromScore(LEAD_TIER_THRESHOLDS.hotMin)).toBe("hot");
    expect(tierFromScore(LEAD_TIER_THRESHOLDS.hotMin - 1)).toBe("warm");
    expect(tierFromScore(LEAD_TIER_THRESHOLDS.warmMin)).toBe("warm");
    expect(tierFromScore(LEAD_TIER_THRESHOLDS.warmMin - 1)).toBe("cold");
  });

  it("queues follow-up on the same floors as scoring", () => {
    expect(planFollowUp(LEAD_TIER_THRESHOLDS.hotMin).delay).toBe("immediate");
    expect(planFollowUp(LEAD_TIER_THRESHOLDS.hotMin - 1).delay).toBe("2h");
    expect(planFollowUp(LEAD_TIER_THRESHOLDS.warmMin).delay).toBe("2h");
    expect(planFollowUp(LEAD_TIER_THRESHOLDS.warmMin - 1).delay).toBe("24h");
  });

  it("keeps scoring and automation copy on the same numbers", () => {
    const copy = leadTierBandCopy();
    expect(copy.scoringHint).toContain(String(LEAD_TIER_THRESHOLDS.hotMin));
    expect(copy.scoringHint).toContain(String(LEAD_TIER_THRESHOLDS.warmMin));
    expect(copy.hotRule).toContain(String(LEAD_TIER_THRESHOLDS.hotMin));
    expect(copy.warmRule).toContain(String(LEAD_TIER_THRESHOLDS.warmMin));
    expect(copy.warmRule).toContain(String(LEAD_TIER_THRESHOLDS.hotMin - 1));
    expect(copy.coldRule).toContain(String(LEAD_TIER_THRESHOLDS.warmMin));
  });
});
