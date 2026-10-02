import { describe, expect, it } from "vitest";
import { fitFor, matchProperties, scoreBuyer, tierFor } from "./scoring";
import { LEAD_SEEDS, PROPERTY_SEEDS } from "./seed";

const lead = (id: string) => LEAD_SEEDS.find((l) => l.id === id)!;
const prop = (id: string) => PROPERTY_SEEDS.find((p) => p.id === id)!;

describe("demo catalog", () => {
  it("has 10 properties and 20 leads with unique ids", () => {
    expect(PROPERTY_SEEDS).toHaveLength(10);
    expect(LEAD_SEEDS).toHaveLength(20);
    expect(new Set(PROPERTY_SEEDS.map((p) => p.id)).size).toBe(10);
    expect(new Set(LEAD_SEEDS.map((l) => l.id)).size).toBe(20);
  });

  it("only points leads at properties that exist", () => {
    const ids = new Set(PROPERTY_SEEDS.map((p) => p.id));
    for (const l of LEAD_SEEDS) if (l.interestedIn) expect(ids.has(l.interestedIn)).toBe(true);
  });

  it("spreads leads across all three tiers so the demo has hot, warm and cold", () => {
    const tiers = new Set(LEAD_SEEDS.map((l) => scoreBuyer(l).tier));
    expect(tiers).toEqual(new Set(["hot", "warm", "cold"]));
  });
});

describe("scoreBuyer", () => {
  it("rates a pre-approved buyer moving next month as hot, and explains why", () => {
    const s = scoreBuyer(lead("lead-ana-torres"));
    expect(s.tier).toBe("hot");
    expect(s.score).toBeGreaterThanOrEqual(85);
    expect(s.factors.map((f) => f.label)).toEqual(["Budget", "Timeline", "Financing", "Specificity", "Engagement"]);
    expect(s.factors.find((f) => f.label === "Financing")?.detail).toMatch(/pre-approved/i);
  });

  it("rates a browser with no budget, zone or timeline as cold", () => {
    const s = scoreBuyer(lead("lead-liam-oconnor"));
    expect(s.tier).toBe("cold");
    expect(s.score).toBeLessThan(60);
  });

  it("scores are the sum of the factors, never above 100, and confidence drops when facts are missing", () => {
    for (const l of LEAD_SEEDS) {
      const s = scoreBuyer(l);
      expect(s.score).toBe(Math.min(100, s.factors.reduce((a, f) => a + f.points, 0)));
      expect(s.score).toBeLessThanOrEqual(100);
    }
    expect(scoreBuyer(lead("lead-liam-oconnor")).confidence).toBeLessThan(scoreBuyer(lead("lead-ana-torres")).confidence);
  });

  it("maps score bands to tiers", () => {
    expect([tierFor(85), tierFor(84), tierFor(60), tierFor(59)]).toEqual(["hot", "warm", "warm", "cold"]);
  });
});

describe("property matching", () => {
  it("puts the listing a buyer asked about, in their zone and budget, first", () => {
    const [top] = matchProperties(lead("lead-ana-torres"), PROPERTY_SEEDS);
    expect(top.property.id).toBe("prop-riverside-loft");
    expect(top.reasons.join(" ")).toMatch(/within budget/i);
  });

  it("returns at most 3 matches and never suggests drafts or sold listings", () => {
    const matches = matchProperties(lead("lead-jordan-hale"), PROPERTY_SEEDS);
    expect(matches.length).toBeLessThanOrEqual(3);
    for (const m of matches) expect(["active", "reserved"]).toContain(m.property.status);
  });

  it("flags an over-budget listing as a concern instead of hiding it", () => {
    const m = fitFor(lead("lead-priya-nair"), prop("prop-riverside-loft"));
    expect(m.concerns.join(" ")).toMatch(/over budget/i);
    expect(m.fit).toBeLessThan(fitFor(lead("lead-priya-nair"), prop("prop-maple-condo")).fit);
  });
});
