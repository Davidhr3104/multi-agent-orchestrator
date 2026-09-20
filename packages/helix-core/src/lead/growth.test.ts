import { describe, expect, it } from "vitest";
import { lookalikeLeads, resurrectLeads, roiMetrics, zombieLeads } from "./growth";
import { attachIntelligence } from "./intelligence";
import { scoreLeadHeuristic } from "./heuristic";
import type { StoredLead } from "../types";

function lead(partial: Partial<StoredLead> & { name: string; email: string }): StoredLead {
  const scored = scoreLeadHeuristic(partial);
  return attachIntelligence(
    {
      ...scored,
      id: partial.id ?? partial.email,
      createdAt: partial.createdAt ?? new Date().toISOString(),
      runId: "r",
      crmStatus: "not_sent",
      name: partial.name,
      email: partial.email,
      source: partial.source ?? "website",
      message: partial.message ?? "",
      budget: partial.budget,
      pipelineStage: partial.pipelineStage,
      dealValue: partial.dealValue,
      closedAt: partial.closedAt,
    },
    null,
    []
  );
}

describe("growth", () => {
  it("resurrects old cold leads", () => {
    const old = lead({
      id: "old",
      name: "Ava",
      email: "ava@example.org",
      message: "Just looking",
      createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
      pipelineStage: "lost",
    });
    const hits = resurrectLeads([old]);
    expect(hits.length).toBe(1);
    expect(hits[0]?.reason).toMatch(/days/i);
  });

  it("finds lookalikes sharing industry and source", () => {
    const a = lead({
      id: "a",
      name: "Maya",
      email: "maya@northwindhvac.com",
      source: "GHL form",
      budget: "8500",
      timeline: "this week",
      message: "HVAC quotes into GoHighLevel this week please.",
    });
    const b = lead({
      id: "b",
      name: "Pat",
      email: "pat@coolairhvac.com",
      source: "GHL form",
      budget: "9000",
      timeline: "this week",
      message: "HVAC inbound scoring for GoHighLevel.",
    });
    const c = lead({
      id: "c",
      name: "Zed",
      email: "zed@other.com",
      source: "unknown",
      message: "hi",
    });
    const likes = lookalikeLeads(a, [a, b, c]);
    expect(likes.map((l) => l.id)).toContain("b");
    expect(likes.map((l) => l.id)).not.toContain("c");
  });

  it("counts spam in ROI", () => {
    const roi = roiMetrics([
      lead({ name: "S", email: "buy@spam.invalid", message: "crypto nft click here free money" }),
    ]);
    expect(roi.spamBlocked).toBeGreaterThanOrEqual(1);
  });

  it("uses 5 minutes per lead for hours saved", () => {
    const one = lead({
      name: "H",
      email: "h@northwindhvac.com",
      budget: "10000",
      timeline: "this week",
      message: "HVAC quotes into GoHighLevel this week please.",
    });
    const roi = roiMetrics(Array.from({ length: 12 }, (_, i) => ({ ...one, id: `h${i}` })));
    expect(roi.hoursSaved).toBe(1);
  });

  it("sums real closed revenue from won deals, separate from pipeline estimate", () => {
    const won = lead({
      id: "won1",
      name: "Won",
      email: "won@example.org",
      budget: "9999", // estimate at capture time — must NOT count toward wonUsd
      tier: "hot",
      pipelineStage: "won",
      dealValue: 15000,
      closedAt: new Date().toISOString(),
    });
    const lost = lead({
      id: "lost1",
      name: "Lost",
      email: "lost@example.org",
      budget: "5000",
      tier: "hot",
      pipelineStage: "lost",
    });
    const openHot = lead({
      id: "open1",
      name: "Open",
      email: "open@example.org",
      budget: "8000",
      tier: "hot",
      timeline: "this week",
      message: "HVAC quotes into GoHighLevel this week please.",
    });
    const roi = roiMetrics([won, lost, openHot]);
    expect(roi.wonUsd).toBe(15000);
    expect(roi.wonCount).toBe(1);
    expect(roi.lostCount).toBe(1);
    expect(roi.winRate).toBeCloseTo(0.5);
    expect(roi.pipelineUsd).toBe(8000); // only the still-open hot lead's estimate
  });

  it("picks zombie cold leads older than 6 months", () => {
    const old = lead({
      id: "z",
      name: "Ava",
      email: "ava@example.org",
      message: "Just looking",
      createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
    });
    expect(zombieLeads([old]).map((l) => l.id)).toContain("z");
  });
});
