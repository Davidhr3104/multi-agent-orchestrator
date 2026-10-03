import type { MatterOutcome, StoredRfp } from "@helix/core";
import { extractDeadlines, goNoGo, winProbability, type DeadlineHit } from "@/lib/rfp-intel";

/**
 * One definition per number, shared by every page (dashboard, Deadlines, Analytics, Outcomes, Audit).
 *
 * - An RFP is OPEN until the partner records a terminal outcome (won, lost, withdrawn, no_bid).
 * - Past due counts OPEN RFPs only, one per RFP: a closed RFP (won, lost, no bid) never reads "past due",
 *   and a second date on the same RFP never counts twice.
 * - Win rate = won / (won + lost), recorded outcomes only (summarizeLegalOutcomes in helix-core).
 * - Hot share = hot RFPs / all RFPs. It is a modeled fit index, not a win rate, and is labelled that way.
 * - Win probability is a pre-decision estimate (rfp-intel.winProbability); the recorded outcome sits beside it.
 */

/*
 * Client-safe copies of two helix-core helpers. The @helix/core barrel pulls Node-only modules into the client
 * bundle, so desk pages cannot import its values. desk-metrics.test.ts checks these against the core versions.
 */
export function effectiveOutcome(rfp: StoredRfp): MatterOutcome | null {
  const d = rfp.partnerDecision;
  if (!d) return null;
  if (d.outcome) return d.outcome;
  if (d.verdict === "NO-GO") return "no_bid";
  return "pending";
}

export function parseMoneyLoose(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || /unspecified|tbd|n\/a|not stated/i.test(text)) return null;
  const thousands = text.match(/\$?\s*([\d,.]+)\s*k\b/i);
  if (thousands) {
    const amount = parseFloat(thousands[1].replace(/,/g, "")) * 1000;
    return Number.isFinite(amount) ? amount : null;
  }
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/** Recorded outcomes only. Win rate = won / (won + lost); null until one of those exists. */
export function outcomeCounts(rfps: StoredRfp[]): { won: number; lost: number; winRate: number | null } {
  const won = rfps.filter((r) => effectiveOutcome(r) === "won").length;
  const lost = rfps.filter((r) => effectiveOutcome(r) === "lost").length;
  return { won, lost, winRate: won + lost > 0 ? won / (won + lost) : null };
}

export function isoDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DeskStage = "won" | "lost" | "withdrawn" | "no_bid" | "pending" | "awaiting";

export const STAGE_LABEL: Record<DeskStage, string> = {
  won: "Won",
  lost: "Lost",
  withdrawn: "Withdrawn",
  no_bid: "No bid",
  pending: "Bid pending",
  awaiting: "Awaiting partner",
};

/** Where an RFP stands, from the partner decision alone. Same answer on every page. */
export function deskStage(rfp: StoredRfp): DeskStage {
  const outcome = effectiveOutcome(rfp);
  if (outcome === "won" || outcome === "lost" || outcome === "withdrawn" || outcome === "no_bid") return outcome;
  if (outcome === "pending") return "pending";
  return "awaiting";
}

export function isClosed(rfp: StoredRfp): boolean {
  const s = deskStage(rfp);
  return s === "won" || s === "lost" || s === "withdrawn" || s === "no_bid";
}

export type DeadlineKind = "past_due" | "today" | "week" | "later" | "undated" | "closed";

export type RfpDeadline = {
  rfp: StoredRfp;
  kind: DeadlineKind;
  /** The date that drives the RFP's urgency: the next upcoming one, or the last one if all have passed. */
  hit: DeadlineHit | null;
};

/** Per-RFP urgency. Closed RFPs are `closed` whatever their dates say. */
export function rfpDeadline(rfp: StoredRfp, now: number): RfpDeadline {
  if (isClosed(rfp)) return { rfp, kind: "closed", hit: null };
  const hits = extractDeadlines(rfp, now).filter((h) => h.days != null);
  if (hits.length === 0) return { rfp, kind: "undated", hit: null };
  const upcoming = hits.filter((h) => (h.days as number) >= 0).sort((a, b) => (a.days as number) - (b.days as number));
  if (upcoming.length === 0) {
    const last = [...hits].sort((a, b) => (b.days as number) - (a.days as number))[0];
    return { rfp, kind: "past_due", hit: last };
  }
  const next = upcoming[0];
  const d = next.days as number;
  return { rfp, kind: d === 0 ? "today" : d <= 7 ? "week" : "later", hit: next };
}

export type DeadlineSummary = {
  pastDue: number;
  dueToday: number;
  /** 1..7 days out */
  thisWeek: number;
  /** 0..14 days out: what "Due in 14D" and the sidebar badge show */
  within14: number;
  closed: number;
  undated: number;
  next: { title: string; date: string; days: number } | null;
};

export function deadlineSummary(rfps: StoredRfp[], now: number): DeadlineSummary {
  const rows = rfps.map((r) => rfpDeadline(r, now));
  const upcoming = rows.filter((r) => r.hit && (r.hit.days as number) >= 0).sort((a, b) => (a.hit!.days as number) - (b.hit!.days as number));
  return {
    pastDue: rows.filter((r) => r.kind === "past_due").length,
    dueToday: rows.filter((r) => r.kind === "today").length,
    thisWeek: rows.filter((r) => r.kind === "week").length,
    within14: rows.filter((r) => r.hit && (r.hit.days as number) >= 0 && (r.hit.days as number) <= 14).length,
    closed: rows.filter((r) => r.kind === "closed").length,
    undated: rows.filter((r) => r.kind === "undated").length,
    next: upcoming[0] ? { title: upcoming[0].rfp.title, date: upcoming[0].hit!.date, days: upcoming[0].hit!.days as number } : null,
  };
}

export type TierCounts = { hot: number; warm: number; cold: number };

export function tierCounts(rfps: StoredRfp[]): TierCounts {
  return {
    hot: rfps.filter((r) => r.tier === "hot").length,
    warm: rfps.filter((r) => r.tier === "warm").length,
    cold: rfps.filter((r) => r.tier === "cold").length,
  };
}

export type VerdictCounts = { go: number; conditional: number; noGo: number };

/** Verdict from goNoGo(), which already treats the partner decision as authoritative. */
export function verdictCounts(rfps: StoredRfp[]): VerdictCounts {
  const out: VerdictCounts = { go: 0, conditional: 0, noGo: 0 };
  for (const r of rfps) {
    const v = goNoGo(r).verdict;
    if (v === "GO") out.go += 1;
    else if (v === "CONDITIONAL") out.conditional += 1;
    else out.noGo += 1;
  }
  return out;
}

/** Funnel from every scored RFP down to the awarded ones. Each step is a subset of the one above. */
export function goFunnel(rfps: StoredRfp[]): { label: string; value: number }[] {
  const pursued = rfps.filter((r) => goNoGo(r).verdict !== "NO-GO");
  const go = rfps.filter((r) => goNoGo(r).verdict === "GO");
  const won = rfps.filter((r) => deskStage(r) === "won");
  return [
    { label: "Scored", value: rfps.length },
    { label: "GO or conditional", value: pursued.length },
    { label: "GO", value: go.length },
    { label: "Won", value: won.length },
  ];
}

export type ProbabilityRow = {
  id: string;
  title: string;
  probability: number;
  matchScore: number;
  stage: DeskStage;
};

export function probabilityRows(rfps: StoredRfp[]): ProbabilityRow[] {
  return rfps
    .map((r) => ({ id: r.id, title: r.title, probability: winProbability(r), matchScore: r.matchScore, stage: deskStage(r) }))
    .sort((a, b) => b.probability - a.probability);
}

/** Bid vs. won amounts for decided RFPs that have a bid. Amounts only exist when the partner entered them. */
export type BidRow = { id: string; title: string; bid: number; won: number | null; stage: DeskStage };

export function bidRows(rfps: StoredRfp[]): BidRow[] {
  const rows: BidRow[] = [];
  for (const r of rfps) {
    const d = r.partnerDecision;
    if (!d) continue;
    const bid = parseMoneyLoose(d.bidAmount);
    if (bid == null) continue;
    rows.push({ id: r.id, title: r.title, bid, won: deskStage(r) === "won" ? (parseMoneyLoose(d.wonAmount) ?? bid) : null, stage: deskStage(r) });
  }
  return rows;
}

/** Share of RFPs whose firm-corpus lookup actually ran (live) or returned cites. */
export function corpusCoverage(rfps: StoredRfp[]): { covered: number; total: number; pct: number } {
  const covered = rfps.filter((r) => r.corpusStatus === "live" || (r.corpusHits?.length ?? 0) > 0).length;
  return { covered, total: rfps.length, pct: rfps.length ? Math.round((covered / rfps.length) * 100) : 0 };
}

export function isDemoDesk(rfps: StoredRfp[]): boolean {
  return rfps.length > 0 && rfps.every((r) => r.id.startsWith("seed-"));
}

/** Counts events per action key, in first-seen order of `order` then alphabetical for the rest. */
export function countBy<T>(items: readonly T[], key: (item: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].map(([k, count]) => ({ key: k, count }));
}

/** The three desk-strategy weights as shares of their sum (the sliders are relative). */
export function normalizeWeights(w: Record<string, number>): { key: string; value: number; share: number }[] {
  const entries = Object.entries(w);
  const total = entries.reduce((s, [, v]) => s + Math.max(0, v), 0);
  return entries.map(([key, value]) => ({ key, value, share: total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0 }));
}

/** Horizontal timeline geometry: maps day offsets to 0..100, padded and always containing "today" (day 0). */
export function timelineScale(offsets: number[], minSpan = 42): { from: number; to: number; pos: (day: number) => number } {
  const lo = Math.min(0, ...offsets);
  const hi = Math.max(0, ...offsets);
  let from = lo - 3;
  let to = hi + 3;
  if (to - from < minSpan) {
    const extra = minSpan - (to - from);
    // keep "today" about a third of the way in when there is room
    from -= Math.round(extra / 3);
    to += extra - Math.round(extra / 3);
  }
  return { from, to, pos: (day) => ((day - from) / (to - from)) * 100 };
}

/** Where a price sits on a floor..ceiling scale, 0..100, clamped. */
export function rangePosition(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}
