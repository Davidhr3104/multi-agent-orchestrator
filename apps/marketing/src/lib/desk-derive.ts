import type { AttributedLead, SpendEvent, StoredCampaign } from "@helix/core";

/**
 * Pure derivations over a DeskSnapshot. Every page reads the same snapshot and goes through these
 * helpers, so a number (spend, score, action) can never differ between pages. No React, no I/O.
 */

/** Rules the engine already applies (see packages/helix-core heuristic) plus the desk-level targets. */
export const RULES = {
  /** avg score at or below this is "pause" territory, at or above SCALE_SCORE is "scale" territory */
  pauseScore: 35,
  scaleScore: 70,
  /** cost per hot lead must be under this for the scale rule */
  costPerHot: 80,
  /** waste ratio goal (spend on spam / total spend) */
  wasteGoal: 0.06,
  /** Meta write path raises daily_budget by this much; every page quotes the same figure */
  scaleStep: 0.2,
} as const;

export type Series = { day: string; spend: number }[];
export type LeadDay = { day: string; leads: number; spam: number; hot: number };

export type DeskTotals = {
  campaigns: number;
  spend: number;
  spendOnSpam: number;
  wastePct: number;
  impressions: number;
  clicks: number;
  formLeads: number;
  scored: number;
  hot: number;
  spam: number;
  costPerHot: number | null;
  avgScore: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function totals(campaigns: readonly StoredCampaign[]): DeskTotals {
  const spend = r2(campaigns.reduce((s, c) => s + c.spend, 0));
  const spendOnSpam = r2(campaigns.reduce((s, c) => s + c.metrics.spendOnSpam, 0));
  const hot = campaigns.reduce((s, c) => s + c.metrics.nHot, 0);
  const scores = campaigns.map((c) => c.metrics.avgScore);
  return {
    campaigns: campaigns.length,
    spend,
    spendOnSpam,
    wastePct: spend > 0 ? spendOnSpam / spend : 0,
    impressions: campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0),
    clicks: campaigns.reduce((s, c) => s + (c.clicks ?? 0), 0),
    formLeads: campaigns.reduce((s, c) => s + c.metrics.formLeads, 0),
    scored: campaigns.reduce((s, c) => s + c.metrics.nLeads, 0),
    hot,
    spam: campaigns.reduce((s, c) => s + c.metrics.nSpam, 0),
    costPerHot: hot > 0 ? r2(spend / hot) : null,
    avgScore: scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : 0,
  };
}

/** Score as shown anywhere: "—" when the campaign has no non-spam lead to average. */
export function scoreText(c: StoredCampaign): string {
  const usable = c.metrics.nLeads - c.metrics.nSpam;
  return usable <= 0 ? "—" : String(Math.round(c.metrics.avgScore));
}

/** One label per campaign, used by /, /review and /attribution. */
export function actionLabel(c: StoredCampaign): string {
  if (c.action === "pause") return "Pause";
  if (c.action === "scale") return `Scale (+${Math.round(RULES.scaleStep * 100)}%)`;
  return c.needsReview ? "Keep · HITL" : "Keep";
}

export function recommendedSpend(c: StoredCampaign): number {
  const cur = Math.max(0, Math.round(c.spend));
  if (c.action === "pause") return 0;
  if (c.action === "scale") return Math.round(cur * (1 + RULES.scaleStep));
  return cur;
}

export type ReviewRow = {
  id: string;
  campaignId: string;
  name: string;
  action: StoredCampaign["action"];
  label: string;
  current: number;
  recommended: number;
  score: number;
  scoreLabel: string;
  confidence: number;
};

/** Confidence in percent, exactly as the engine reports it (no floor). */
export function reviewRows(campaigns: readonly StoredCampaign[]): ReviewRow[] {
  return campaigns
    .filter((c) => c.needsReview)
    .map((c) => ({
      id: c.id,
      campaignId: c.campaignId,
      name: c.name,
      action: c.action,
      label: actionLabel(c),
      current: Math.max(0, Math.round(c.spend)),
      recommended: recommendedSpend(c),
      score: c.metrics.avgScore,
      scoreLabel: scoreText(c),
      confidence: Math.round(c.confidence * 1000) / 10,
    }));
}

export type AttributionRow = {
  campaignId: string;
  name: string;
  platform: StoredCampaign["platform"];
  spend: number;
  forms: number;
  scored: number;
  hot: number;
  spam: number;
  costPerHot: number | null;
  score: number;
  scoreLabel: string;
  action: StoredCampaign["action"];
  label: string;
};

export function attributionRows(campaigns: readonly StoredCampaign[]): AttributionRow[] {
  return campaigns.map((c) => ({
    campaignId: c.campaignId,
    name: c.name,
    platform: c.platform,
    spend: c.spend,
    forms: c.metrics.formLeads,
    scored: c.metrics.nLeads,
    hot: c.metrics.nHot,
    spam: c.metrics.nSpam,
    costPerHot: c.metrics.costPerHot,
    score: c.metrics.avgScore,
    scoreLabel: scoreText(c),
    action: c.action,
    label: actionLabel(c),
  }));
}

export type FunnelStepData = { label: string; value: number; hint?: string };

/** Impressions → clicks → form leads → scored → hot. Steps with no data at all are dropped, never faked. */
export function funnelSteps(campaigns: readonly StoredCampaign[]): FunnelStepData[] {
  const t = totals(campaigns);
  const steps: FunnelStepData[] = [
    { label: "Impressions", value: t.impressions },
    { label: "Clicks", value: t.clicks },
    { label: "Form leads", value: t.formLeads },
    { label: "Scored leads", value: t.scored },
    { label: "Hot leads", value: t.hot },
  ];
  return steps.filter((s) => s.value > 0);
}

/** Spend split by lead quality. Spam share is the engine's own spendOnSpam; hot is proportional to hot leads. */
export function spendSegments(c: StoredCampaign): { hot: number; mid: number; spam: number } {
  const spam = Math.min(c.spend, c.metrics.spendOnSpam);
  const share = c.metrics.nLeads > 0 ? c.metrics.nHot / c.metrics.nLeads : 0;
  const hot = r2(Math.min(c.spend - spam, c.spend * share));
  return { hot, spam: r2(spam), mid: r2(Math.max(0, c.spend - spam - hot)) };
}

/** Leads that belong to a campaign shown on the desk (leads of unjoined campaigns are not counted anywhere). */
export function joinedLeads(leads: readonly AttributedLead[], campaigns: readonly StoredCampaign[]): AttributedLead[] {
  const ids = new Set(campaigns.map((c) => c.campaignId));
  return leads.filter((l) => ids.has(l.campaignId));
}

export function tierCounts(leads: readonly AttributedLead[]): { hot: number; warm: number; cold: number; spam: number } {
  const out = { hot: 0, warm: 0, cold: 0, spam: 0 };
  for (const l of leads) {
    if (l.classification === "spam") out.spam += 1;
    else out[l.tier] += 1;
  }
  return out;
}

export function histogram(values: readonly number[], edges: readonly number[]): { label: string; value: number }[] {
  const bins = edges.slice(0, -1).map((lo, i) => ({ lo, hi: edges[i + 1], value: 0 }));
  for (const v of values) {
    const bin = bins.find((b, i) => v >= b.lo && (v < b.hi || (i === bins.length - 1 && v <= b.hi)));
    if (bin) bin.value += 1;
  }
  return bins.map((b) => ({ label: `${b.lo}–${b.hi}`, value: b.value }));
}

export const SCORE_EDGES = [0, 20, 35, 50, 70, 85, 100] as const;
export const CONFIDENCE_EDGES = [0, 40, 50, 60, 70, 80, 90, 100] as const;

export function scoreHistogram(leads: readonly AttributedLead[]) {
  return histogram(leads.map((l) => l.score), SCORE_EDGES);
}

export function confidenceHistogram(campaigns: readonly StoredCampaign[]) {
  return histogram(campaigns.map((c) => c.confidence * 100), CONFIDENCE_EDGES);
}

/** Daily lead counts (all / spam / hot) derived from lead timestamps, zero-filled across the window. */
export function dailyLeadSeries(leads: readonly AttributedLead[], from: string, to: string): LeadDay[] {
  const map = new Map<string, LeadDay>();
  const add = (day: string, n: number) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n)).toISOString().slice(0, 10);
  for (let day = from; day <= to; day = add(day, 1)) map.set(day, { day, leads: 0, spam: 0, hot: 0 });
  for (const l of leads) {
    const row = map.get(l.createdAt.slice(0, 10));
    if (!row) continue;
    row.leads += 1;
    if (l.classification === "spam") row.spam += 1;
    else if (l.tier === "hot") row.hot += 1;
  }
  return [...map.values()];
}

export function sumSeries(parts: readonly Series[]): Series {
  const map = new Map<string, number>();
  for (const s of parts) for (const p of s) map.set(p.day, (map.get(p.day) ?? 0) + p.spend);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, spend]) => ({ day, spend: r2(spend) }));
}

export type UnmatchedGroup = {
  campaignId: string;
  name: string;
  platform: SpendEvent["platform"];
  events: number;
  spend: number;
  share: number;
  firstDay: string;
  lastDay: string;
  ids: string[];
};

/** Collapses identical spend rows into one group per campaign id (30 rows of "Ad E" become one "×30"). */
export function groupUnmatched(rows: readonly SpendEvent[]): UnmatchedGroup[] {
  const total = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
  const map = new Map<string, UnmatchedGroup>();
  for (const r of rows) {
    const g = map.get(r.campaignId) ?? {
      campaignId: r.campaignId,
      name: r.name,
      platform: r.platform,
      events: 0,
      spend: 0,
      share: 0,
      firstDay: r.occurredAt.slice(0, 10),
      lastDay: r.occurredAt.slice(0, 10),
      ids: [],
    };
    g.events += 1;
    g.spend = r2(g.spend + (r.spend ?? 0));
    g.ids.push(r.id);
    const day = r.occurredAt.slice(0, 10);
    if (day < g.firstDay) g.firstDay = day;
    if (day > g.lastDay) g.lastDay = day;
    map.set(r.campaignId, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, share: total > 0 ? g.spend / total : 0 }))
    .sort((a, b) => b.spend - a.spend);
}

export type RuleId = "scale" | "pause" | "spam" | "review";

/** How many campaigns satisfy a rule today. Mirrors the thresholds in RULES; never claims a past trigger. */
export function ruleMatches(rule: RuleId, campaigns: readonly StoredCampaign[]): StoredCampaign[] {
  switch (rule) {
    case "scale":
      return campaigns.filter((c) => c.metrics.avgScore >= RULES.scaleScore && (c.metrics.costPerHot ?? Infinity) < RULES.costPerHot);
    case "pause":
      return campaigns.filter((c) => c.action === "pause");
    case "spam":
      return campaigns.filter((c) => c.metrics.spamRate >= 0.35);
    case "review":
      return campaigns.filter((c) => c.needsReview);
  }
}

/**
 * Estimated spend on spam per day: each campaign's daily spend times its spam rate for the window.
 * The desk measures spam per campaign, not per day, so this is an allocation, never a per-day measurement.
 */
export function dailySpamSpend(campaigns: readonly StoredCampaign[], byCampaign: Record<string, Series>): Series {
  return sumSeries(
    campaigns.map((c) => (byCampaign[c.campaignId] ?? []).map((p) => ({ day: p.day, spend: p.spend * (c.metrics.spamRate ?? 0) })))
  );
}
