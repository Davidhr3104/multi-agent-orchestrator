import { describe, expect, it } from "vitest";
import { citeSpan } from "../fact";
import { scoreLeadHeuristic } from "./heuristic";

describe("lead heuristic", () => {
  it("classifies crypto blast as spam", () => {
    const scored = scoreLeadHeuristic({
      name: "Bot",
      email: "buy@spam.invalid",
      message: "Buy followers and crypto nft drop click here free money",
    });
    expect(scored.classification).toBe("spam");
    expect(scored.score).toBeLessThanOrEqual(18);
    expect(scored.tier).toBe("cold");
  });

  it("scores a funded HVAC lead as hot", () => {
    const scored = scoreLeadHeuristic({
      name: "Maya Chen",
      email: "maya@northwindhvac.com",
      source: "GHL form",
      budget: "8500",
      timeline: "this week",
      message:
        "We need AI to score inbound HVAC quotes. Ready to start this week if it plugs into GoHighLevel and routes junk leads.",
    });
    expect(scored.classification).toBe("lead");
    expect(scored.tier).toBe("hot");
    expect(scored.score).toBeGreaterThanOrEqual(75);
  });

  it("flags thin mid scores for HITL", () => {
    const scored = scoreLeadHeuristic({
      name: "Ava",
      email: "ava@example.org",
      source: "website",
      message: "Just looking at how the scoring works before we talk.",
    });
    expect(scored.classification).toBe("info");
    expect(scored.needsReview).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(40);
    expect(scored.score).toBeLessThanOrEqual(60);
  });

  it("uses custom thresholds instead of the hardcoded 40-60 band", () => {
    const scored = scoreLeadHeuristic(
      {
        name: "Ava",
        email: "ava@example.org",
        source: "website",
        message: "Just looking at how the scoring works before we talk.",
      },
      { hitl: 0.4, thresholds: { autoQualifyScore: 80, dqScore: 45, vipScore: 90, nurtureMin: 30, nurtureMax: 65 } }
    );
    // Same input as the existing "flags thin mid scores" test, but with dqScore raised to 45:
    // a lead scoring in the low-40s should now fall UNDER the DQ threshold and not need review.
    expect(scored.score).toBeLessThan(46);
    expect(scored.needsReview).toBe(false);
  });

  it("defaults reproduce today's behavior when no thresholds are passed", () => {
    const scored = scoreLeadHeuristic({
      name: "Ava",
      email: "ava@example.org",
      source: "website",
      message: "Just looking at how the scoring works before we talk.",
    });
    expect(scored.needsReview).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(40);
    expect(scored.score).toBeLessThanOrEqual(60);
  });
});

describe("FACT citeSpan", () => {
  it("returns verified char offsets for a quote", () => {
    const doc = "Budget $85k Method BEAR";
    const cite = citeSpan(doc, "BEAR");
    expect(cite.verified).toBe(true);
    expect(cite.quote).toBe("BEAR");
    expect(doc.slice(cite.spanStart, cite.spanEnd)).toBe("BEAR");
  });
});
