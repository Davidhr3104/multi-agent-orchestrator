import type { Brand } from "../types";
import { callClaude, ClaudeUnavailableError, type AiCallRecord } from "./claude";
import type { FetchLike } from "./config";
import { realAccounts, realPosts, type InsightsSnapshot } from "./insights";
import { computeWeeklyMetrics, factsProse, proseUsesOnlyFacts, weeklyFacts, type Fact, type WeeklyMetrics } from "./performance";

export type WeeklyReport = {
  id: string;
  createdAt: string;
  dataFetchedAt: string;
  metrics: WeeklyMetrics;
  facts: Fact[];
  prose: string;
  /** claude = Claude wrote the prose from the facts. computed = the facts as plain sentences, because Claude was unavailable or cited a number not in the facts. */
  engine: "claude" | "computed";
  note: string;
  aiCall?: AiCallRecord;
};

type State = { reports: WeeklyReport[] };

function state(): State {
  const g = globalThis as typeof globalThis & { __helixSocialWeekly?: State };
  g.__helixSocialWeekly ??= { reports: [] };
  return g.__helixSocialWeekly;
}

export function listWeeklyReports(): WeeklyReport[] {
  return state().reports.map((r) => ({ ...r }));
}

export function resetWeeklyReports() {
  state().reports = [];
}

const SYSTEM = [
  "You write a short weekly social media report for a brand team.",
  "Use only the facts you are given. Every number you write must appear exactly as written in the facts.",
  "Do not estimate, round differently, project, or invent any metric. If a metric is missing, say it was not reported.",
  "Plain prose, 2 short paragraphs, then up to 3 bullet suggestions that do not contain numbers.",
].join(" ");

export async function writeWeeklyReport(snap: InsightsSnapshot, brand: Brand, opts: { fetchImpl?: FetchLike; now?: Date } = {}): Promise<WeeklyReport> {
  const now = opts.now ?? new Date();
  const metrics = computeWeeklyMetrics(realPosts(snap), realAccounts(snap), now);
  const facts = weeklyFacts(metrics);
  const base = { id: `wk-${now.getTime().toString(36)}`, createdAt: now.toISOString(), dataFetchedAt: snap.fetchedAt, metrics, facts };
  let report: WeeklyReport;
  try {
    const { text, call } = await callClaude(
      {
        purpose: "weekly_report",
        system: SYSTEM,
        prompt: `Brand: ${brand.name}. Voice: ${brand.voice.join(", ") || "not set"}.\n\nFacts computed from the Meta Graph API:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}`,
        maxTokens: 700,
      },
      opts.fetchImpl
    );
    report = proseUsesOnlyFacts(text, facts)
      ? { ...base, prose: text, engine: "claude", note: "Claude wrote the prose. Every number was computed in code from the Graph API and checked against the prose.", aiCall: call }
      : { ...base, prose: factsProse(facts), engine: "computed", note: "Claude's text cited a number that was not computed, so it was discarded. These are the computed facts.", aiCall: call };
  } catch (err) {
    if (!(err instanceof ClaudeUnavailableError)) throw err;
    report = { ...base, prose: factsProse(facts), engine: "computed", note: `${err.message} These are the computed facts without prose.` };
  }
  state().reports.unshift(report);
  state().reports = state().reports.slice(0, 12);
  return report;
}
