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

  it("does not send a below-DQ info lead to HITL just because heuristic confidence is low", () => {
    // Ava scores ~42 (info cap) with generic confidence 0.64 < hitl 0.65.
    // LEADS-P1-1 acceptance: a lead under the DQ threshold must NOT enter HITL.
    const scored = scoreLeadHeuristic({
      name: "Ava",
      email: "ava@example.org",
      source: "website",
      message: "Just looking at how the scoring works before we talk.",
    });
    expect(scored.classification).toBe("info");
    expect(scored.score).toBeGreaterThanOrEqual(40);
    expect(scored.score).toBeLessThan(50);
    expect(scored.confidence).toBeLessThan(0.65);
    expect(scored.needsReview).toBe(false);
  });

  it("uses custom thresholds instead of the hardcoded 40-60 band", () => {
    const scored = scoreLeadHeuristic(
      {
        name: "Ava",
        email: "ava@example.org",
        source: "website",
        message: "Just looking at how the scoring works before we talk.",
      },
      { thresholds: { autoQualifyScore: 80, dqScore: 45, vipScore: 90, nurtureMin: 30, nurtureMax: 65 } }
    );
    // dqScore 45: a lead scoring in the low-40s falls UNDER the DQ threshold and does not need review,
    // with the default hitl (no workaround needed).
    expect(scored.score).toBeLessThan(45);
    expect(scored.needsReview).toBe(false);
  });

  it("custom thresholds can pull the same lead into the HITL band", () => {
    const scored = scoreLeadHeuristic(
      {
        name: "Ava",
        email: "ava@example.org",
        source: "website",
        message: "Just looking at how the scoring works before we talk.",
      },
      { thresholds: { autoQualifyScore: 80, dqScore: 35, vipScore: 90, nurtureMin: 30, nurtureMax: 65 } }
    );
    expect(scored.score).toBeGreaterThan(35);
    expect(scored.needsReview).toBe(true);
  });

  it("defaults: below-DQ lead is not reviewed, in-band lead is reviewed", () => {
    const below = scoreLeadHeuristic({
      name: "Ava",
      email: "ava@example.org",
      source: "website",
      message: "Just looking at how the scoring works before we talk.",
    });
    expect(below.score).toBeLessThan(50);
    expect(below.needsReview).toBe(false);

    // No budget/timeline -> confidence 0.64; score lands in the 51-79 band.
    const inBand = scoreLeadHeuristic({
      name: "Leo",
      email: "leo@acmeplumbing.com",
      source: "GHL form",
      message: "We run a 12-truck plumbing company and want inbound leads scored and routed automatically.",
    });
    expect(inBand.score).toBeGreaterThan(50);
    expect(inBand.score).toBeLessThan(80);
    expect(inBand.needsReview).toBe(true);
  });

  it("low confidence still forces review on a high score (no silent auto-approve on weak evidence)", () => {
    const scored = scoreLeadHeuristic(
      {
        name: "Maya Chen",
        email: "maya@northwindhvac.com",
        source: "GHL form",
        budget: "8500",
        timeline: "this week",
        message:
          "We need AI to score inbound HVAC quotes. Ready to start this week if it plugs into GoHighLevel and routes junk leads.",
      },
      { hitl: 0.9 }
    );
    expect(scored.score).toBeGreaterThanOrEqual(80);
    expect(scored.confidence).toBeLessThan(0.9);
    expect(scored.needsReview).toBe(true);
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
