import { beforeEach, describe, expect, it } from "vitest";
import type { AttributedLead, SpendEvent } from "@helix/core";
import {
  RULES,
  actionLabel,
  attributionRows,
  confidenceHistogram,
  dailyLeadSeries,
  dailySpamSpend,
  funnelSteps,
  groupUnmatched,
  histogram,
  joinedLeads,
  reviewRows,
  ruleMatches,
  scoreText,
  spendSegments,
  sumSeries,
  tierCounts,
  totals,
} from "./desk-derive";
import { getSnapshot, loadDemoCatalog } from "./store";
import { recLabel } from "./format";

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("one source of truth across /, /review and /attribution", () => {
  it("spend adds up to the same figure on every page (and equals the waste summary)", async () => {
    const snap = await getSnapshot("7d");
    const home = totals(snap.campaigns).spend;
    const attribution = attributionRows(snap.campaigns).reduce((s, r) => s + r.spend, 0);
    const reviewScope = snap.campaigns.filter((c) => c.needsReview).reduce((s, c) => s + c.spend, 0);
    const reviewed = reviewRows(snap.campaigns).reduce((s, r) => s + r.current, 0);
    expect(Math.round(attribution * 100) / 100).toBe(home);
    expect(home).toBe(snap.waste.totalSpend);
    // /review shows a subset (needs review), rounded to whole dollars per row
    expect(Math.abs(reviewed - reviewScope)).toBeLessThan(snap.campaigns.length);
    expect(reviewed).toBeLessThanOrEqual(Math.round(home) + snap.campaigns.length);
  });

  it("every campaign has the same action, score and label on all three pages", async () => {
    const snap = await getSnapshot("7d");
    const attr = new Map(attributionRows(snap.campaigns).map((r) => [r.campaignId, r]));
    for (const row of reviewRows(snap.campaigns)) {
      const a = attr.get(row.campaignId)!;
      expect(row.action).toBe(a.action);
      expect(row.label).toBe(a.label);
      expect(row.scoreLabel).toBe(a.scoreLabel);
    }
    for (const c of snap.campaigns) {
      const a = attr.get(c.campaignId)!;
      expect(a.action).toBe(c.action);
      expect(a.label).toBe(actionLabel(c));
      // the home table's REC badge is the same decision, minus the scale % hint
      expect(actionLabel(c).startsWith(recLabel(c).split(" ")[0])).toBe(true);
    }
  });

  it("a scale recommendation uses the single scale step everywhere", async () => {
    const snap = await getSnapshot("7d");
    const b = snap.campaigns.find((c) => c.campaignId === "ad-b-quality")!;
    const row = attributionRows([b])[0];
    const rec = reviewRows([{ ...b, needsReview: true }])[0];
    if (b.action === "scale") {
      expect(row.label).toContain(`+${RULES.scaleStep * 100}%`);
      expect(rec.recommended).toBe(Math.round(Math.round(b.spend) * (1 + RULES.scaleStep)));
    }
    expect(rec.confidence).toBe(Math.round(b.confidence * 1000) / 10);
  });

  it("confidence is the engine's own value, not a floor", async () => {
    const snap = await getSnapshot("7d");
    const values = new Set(reviewRows(snap.campaigns).map((r) => r.confidence));
    expect([...values].every((v) => v >= 0 && v <= 100)).toBe(true);
    // the thin-data campaigns report 48%, below the old 55% clamp
    expect(Math.min(...values)).toBeLessThan(55);
  });

  it("per-campaign daily series add up to the campaign spend", async () => {
    const snap = await getSnapshot("7d");
    for (const c of snap.campaigns) {
      const sum = snap.seriesByCampaign[c.campaignId].reduce((s, p) => s + p.spend, 0);
      expect(Math.round(sum * 100) / 100).toBeCloseTo(c.spend, 1);
    }
    const joined = sumSeries(Object.values(snap.seriesByCampaign));
    expect(joined.reduce((s, p) => s + p.spend, 0)).toBeCloseTo(totals(snap.campaigns).spend, 1);
  });

  it("daily lead series add up to the scored leads in the campaign metrics", async () => {
    const snap = await getSnapshot("7d");
    const t = totals(snap.campaigns);
    expect(snap.leadSeries.reduce((s, d) => s + d.leads, 0)).toBe(t.scored);
    expect(snap.leadSeries.reduce((s, d) => s + d.spam, 0)).toBe(t.spam);
    expect(snap.leadSeries.reduce((s, d) => s + d.hot, 0)).toBe(t.hot);
  });
});

describe("derivations", () => {
  it("funnel drops empty steps and never grows", async () => {
    const snap = await getSnapshot("7d");
    const steps = funnelSteps(snap.campaigns);
    expect(steps.map((s) => s.label)[0]).toBe("Impressions");
    expect(steps.every((s) => s.value > 0)).toBe(true);
    expect(funnelSteps([])).toEqual([]);
  });

  it("splits a campaign's spend into hot / middle / spam without losing a cent", async () => {
    const snap = await getSnapshot("7d");
    for (const c of snap.campaigns) {
      const s = spendSegments(c);
      expect(s.hot + s.mid + s.spam).toBeCloseTo(c.spend, 1);
      expect(s.spam).toBeCloseTo(c.metrics.spendOnSpam, 1);
    }
  });

  it("counts leads by tier with spam as its own bucket", () => {
    const lead = (id: string, tier: AttributedLead["tier"], classification: AttributedLead["classification"]): AttributedLead => ({
      id,
      campaignId: "c",
      name: id,
      email: `${id}@x.example`,
      classification,
      score: 50,
      tier,
      confidence: 0.5,
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(tierCounts([lead("1", "hot", "lead"), lead("2", "cold", "spam"), lead("3", "warm", "info")])).toEqual({ hot: 1, warm: 1, cold: 0, spam: 1 });
  });

  it("histogram puts the top edge in the last bin", () => {
    const h = histogram([0, 19, 20, 100], [0, 20, 50, 100]);
    expect(h.map((b) => b.value)).toEqual([2, 1, 1]);
  });

  it("builds a confidence histogram in percent", async () => {
    const snap = await getSnapshot("7d");
    const total = confidenceHistogram(snap.campaigns).reduce((s, b) => s + b.value, 0);
    expect(total).toBe(snap.campaigns.length);
  });

  it("zero-fills the daily lead series across the window", () => {
    const days = dailyLeadSeries([], "2026-03-01", "2026-03-03");
    expect(days.map((d) => d.day)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
    expect(days.every((d) => d.leads === 0)).toBe(true);
  });

  it("shows '—' instead of a fake 0 score when every lead is spam", async () => {
    const snap = await getSnapshot("7d");
    const allSpam = snap.campaigns.find((c) => c.metrics.nLeads > 0 && c.metrics.nLeads === c.metrics.nSpam);
    if (allSpam) expect(scoreText(allSpam)).toBe("—");
  });

  it("joinedLeads drops leads of campaigns that are not on the desk", async () => {
    const snap = await getSnapshot("7d");
    const j = joinedLeads(snap.leads, snap.campaigns);
    expect(j.length).toBeLessThanOrEqual(snap.leads.length);
    expect(j.reduce((n, l) => n + (l.classification === "spam" ? 1 : 0), 0)).toBe(totals(snap.campaigns).spam);
  });

  it("rule previews count the campaigns that meet them today", async () => {
    const snap = await getSnapshot("7d");
    expect(ruleMatches("pause", snap.campaigns).every((c) => c.action === "pause")).toBe(true);
    expect(ruleMatches("review", snap.campaigns).length).toBe(snap.campaigns.filter((c) => c.needsReview).length);
    expect(ruleMatches("scale", [])).toEqual([]);
  });
});

describe("unmatched spend grouping", () => {
  const row = (i: number, campaignId: string, spend: number): SpendEvent => ({
    id: `e${i}`,
    campaignId,
    name: campaignId.toUpperCase(),
    platform: "meta",
    spend,
    occurredAt: `2026-03-${String(10 + (i % 20)).padStart(2, "0")}`,
  });

  it("collapses identical rows into one group with a counter and share of orphan spend", () => {
    const rows = [...Array.from({ length: 30 }, (_, i) => row(i, "ad-e", 18)), row(99, "ad-z", 60)];
    const groups = groupUnmatched(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ campaignId: "ad-e", events: 30, spend: 540 });
    expect(groups[0].share).toBeCloseTo(540 / 600, 5);
    expect(groups[0].ids).toHaveLength(30);
    expect(groups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(1, 5);
  });

  it("returns nothing for an empty queue", () => {
    expect(groupUnmatched([])).toEqual([]);
  });

  it("matches the demo desk's orphan spend", async () => {
    const snap = await getSnapshot("30d");
    const groups = groupUnmatched(snap.unmatched);
    expect(groups.reduce((s, g) => s + g.events, 0)).toBe(snap.unmatched.length);
  });
});

describe("estimated daily spend on spam", () => {
  it("never exceeds the daily spend and sums to the engine's spend on spam", async () => {
    const snap = await getSnapshot("7d");
    const days = dailySpamSpend(snap.campaigns, snap.seriesByCampaign);
    const total = days.reduce((s, d) => s + d.spend, 0);
    expect(total).toBeCloseTo(totals(snap.campaigns).spendOnSpam, 0);
    for (const d of days) expect(d.spend).toBeLessThanOrEqual((snap.series.find((p) => p.day === d.day)?.spend ?? 0) + 0.01);
  });
});
