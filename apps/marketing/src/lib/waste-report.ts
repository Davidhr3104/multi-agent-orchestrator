import {
  getSecret,
  parseJsonObject,
  runWithPolicy,
  type CampaignAction,
  type MarketingWindow,
  type StoredCampaign,
} from "@helix/core";
import { marketingActions } from "@/lib/ai-actions";
import { campaignSource, getAllSourceStatus, SOURCE_LABEL, type AdSource, type SourceStatus } from "@/lib/ad-sources";
import { CLAUDE_MODEL, estimateClaudeCostUsd, recordAiUsage } from "@/lib/ai-usage";
import { readJsonFile, writeJsonFile } from "@/lib/desk-files";
import { currentDeskMode, getDecision, getSnapshot, type DeskSnapshot } from "@/lib/store";

/**
 * "Where is ad money going to spam?" — every number here is computed in code from real spend joined
 * with scored leads. Claude (when configured) only puts those numbers into words; it never computes.
 */

/** Same floor the campaign heuristic uses before it makes a hard call. */
export const MIN_LEADS_FOR_VERDICT = 8;
export const SPAM_HEAVY_SHARE = 0.45;
/** A campaign whose cost per good lead is this many times the desk's blended cost is flagged. */
export const EXPENSIVE_GOOD_LEAD_MULTIPLIER = 2;
export const NO_GOOD_LEADS_MIN_LEADS = 3;
const MAX_PROPOSALS = 5;

export type WasteFlag = "spam_heavy" | "no_good_leads" | "expensive_good_leads";

export type CampaignWaste = {
  campaignId: string;
  name: string;
  source: AdSource | "other";
  sourceLabel: string;
  spend: number;
  nLeads: number;
  nSpam: number;
  nGood: number;
  nHot: number;
  spamShare: number;
  spendOnSpam: number;
  costPerGoodLead: number | null;
  costPerHot: number | null;
  heuristicAction: CampaignAction;
  humanDecision: CampaignAction | null;
  flags: WasteFlag[];
  wasteful: boolean;
};

export type SourceWaste = {
  source: AdSource | "other";
  label: string;
  spend: number;
  spendOnSpam: number;
  campaigns: number;
};

export type WasteMetrics = {
  window: MarketingWindow;
  from: string;
  to: string;
  totalSpend: number;
  spendOnSpam: number;
  wastePct: number;
  nLeads: number;
  nSpam: number;
  nGood: number;
  blendedCostPerGoodLead: number | null;
  /** Spend on campaigns with no scored leads yet: cannot be judged, so it is never called waste. */
  unjudgedSpend: number;
  unjudgedCampaigns: number;
  campaigns: CampaignWaste[];
  bySource: SourceWaste[];
};

export type WasteProposal = {
  action: "pause_campaign" | "scale_campaign";
  campaignId: string;
  label: string;
  reason: string;
  /** Always "confirm": pause/scale change spend and are never run without a person. */
  risk: "confirm";
  riskReasons: string[];
};

export type WasteNarrative = { summary: string; campaigns: { campaignId: string; name: string; why: string }[] };

export type WasteReport = {
  generatedAt: string;
  trigger: "manual" | "cron";
  dataKind: "demo" | "live";
  engine: "claude" | "deterministic";
  engineNote: string;
  metrics: WasteMetrics;
  narrative: WasteNarrative;
  deterministic: WasteNarrative;
  /** Numbers in Claude's text that do not appear in the computed metrics (should be empty). */
  unverifiedNumbers: string[];
  proposals: WasteProposal[];
  aiCost: { inputTokens: number; outputTokens: number; estimatedUsd: number; isEstimate: true } | null;
  sources: Record<AdSource, SourceStatus>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function computeWasteMetrics(
  snapshot: Pick<DeskSnapshot, "window" | "from" | "to" | "campaigns" | "unmatched">,
  decisions: Map<string, CampaignAction> = new Map()
): WasteMetrics {
  const base = snapshot.campaigns.map((c: StoredCampaign) => {
    const nLeads = c.metrics.nLeads;
    const nSpam = c.metrics.nSpam;
    const nGood = Math.max(0, nLeads - nSpam);
    const source = campaignSource(c.campaignId, c.platform);
    return {
      campaignId: c.campaignId,
      name: c.name,
      source,
      sourceLabel: SOURCE_LABEL[source],
      spend: r2(c.spend),
      nLeads,
      nSpam,
      nGood,
      nHot: c.metrics.nHot,
      spamShare: nLeads === 0 ? 0 : r2(nSpam / nLeads),
      spendOnSpam: r2(c.metrics.spendOnSpam),
      costPerGoodLead: nGood > 0 ? r2(c.spend / nGood) : null,
      costPerHot: c.metrics.costPerHot,
      heuristicAction: c.action,
      humanDecision: decisions.get(c.campaignId) ?? null,
    };
  });

  const totalSpend = r2(base.reduce((s, c) => s + c.spend, 0));
  const spendOnSpam = r2(base.reduce((s, c) => s + c.spendOnSpam, 0));
  const nLeads = base.reduce((s, c) => s + c.nLeads, 0);
  const nSpam = base.reduce((s, c) => s + c.nSpam, 0);
  const nGood = base.reduce((s, c) => s + c.nGood, 0);
  const blendedCostPerGoodLead = nGood > 0 ? r2(totalSpend / nGood) : null;

  const campaigns: CampaignWaste[] = base
    .map((c) => {
      const flags: WasteFlag[] = [];
      if (c.nLeads >= MIN_LEADS_FOR_VERDICT && c.spamShare >= SPAM_HEAVY_SHARE) flags.push("spam_heavy");
      if (c.nGood === 0 && c.nLeads >= NO_GOOD_LEADS_MIN_LEADS && c.spend > 0) flags.push("no_good_leads");
      if (
        c.nLeads >= MIN_LEADS_FOR_VERDICT &&
        c.costPerGoodLead !== null &&
        blendedCostPerGoodLead !== null &&
        c.costPerGoodLead > blendedCostPerGoodLead * EXPENSIVE_GOOD_LEAD_MULTIPLIER
      ) {
        flags.push("expensive_good_leads");
      }
      return { ...c, flags, wasteful: flags.length > 0 };
    })
    .sort((a, b) => b.spendOnSpam - a.spendOnSpam || b.spend - a.spend);

  const bySourceMap = new Map<string, SourceWaste>();
  for (const c of campaigns) {
    const row = bySourceMap.get(c.source) ?? { source: c.source, label: c.sourceLabel, spend: 0, spendOnSpam: 0, campaigns: 0 };
    row.spend = r2(row.spend + c.spend);
    row.spendOnSpam = r2(row.spendOnSpam + c.spendOnSpam);
    row.campaigns += 1;
    bySourceMap.set(c.source, row);
  }

  return {
    window: snapshot.window,
    from: snapshot.from,
    to: snapshot.to,
    totalSpend,
    spendOnSpam,
    wastePct: totalSpend > 0 ? r2(spendOnSpam / totalSpend) : 0,
    nLeads,
    nSpam,
    nGood,
    blendedCostPerGoodLead,
    unjudgedSpend: r2(snapshot.unmatched.reduce((s, e) => s + e.spend, 0)),
    unjudgedCampaigns: new Set(snapshot.unmatched.map((e) => e.campaignId)).size,
    campaigns,
    bySource: [...bySourceMap.values()].sort((a, b) => b.spend - a.spend),
  };
}

function campaignWhy(c: CampaignWaste, m: WasteMetrics): string {
  const parts = [`${usd(c.spend)} spent on ${c.sourceLabel}, ${c.nLeads} scored leads, ${c.nSpam} spam (${pct(c.spamShare)}) — about ${usd(c.spendOnSpam)} went to spam.`];
  if (c.flags.includes("no_good_leads")) parts.push("Not one non-spam lead in the window.");
  if (c.costPerGoodLead !== null && m.blendedCostPerGoodLead !== null) {
    parts.push(`Cost per good lead ${usd(c.costPerGoodLead)} vs ${usd(m.blendedCostPerGoodLead)} across the desk.`);
  }
  return parts.join(" ");
}

export function deterministicNarrative(m: WasteMetrics): WasteNarrative {
  const wasteful = m.campaigns.filter((c) => c.wasteful);
  const head =
    m.totalSpend <= 0
      ? "No joined spend in this window — upload spend or sync an ad platform, and sync scored leads."
      : `${usd(m.spendOnSpam)} of ${usd(m.totalSpend)} (${pct(m.wastePct)}) went to spam leads between ${m.from} and ${m.to}.`;
  const tail =
    wasteful.length === 0
      ? " No campaign crosses the waste thresholds."
      : ` ${wasteful.length} campaign${wasteful.length === 1 ? "" : "s"} cross the waste thresholds: ${wasteful.map((c) => c.name).join(", ")}.`;
  const unjudged = m.unjudgedSpend > 0 ? ` ${usd(m.unjudgedSpend)} on ${m.unjudgedCampaigns} campaign(s) has no scored leads yet and is not judged.` : "";
  return {
    summary: `${head}${m.totalSpend > 0 ? tail : ""}${unjudged}`,
    campaigns: wasteful.map((c) => ({ campaignId: c.campaignId, name: c.name, why: campaignWhy(c, m) })),
  };
}

export async function buildProposals(m: WasteMetrics): Promise<WasteProposal[]> {
  const candidates: Omit<WasteProposal, "risk" | "riskReasons">[] = [];
  for (const c of m.campaigns) {
    if (c.wasteful && c.humanDecision !== "pause") {
      candidates.push({
        action: "pause_campaign",
        campaignId: c.campaignId,
        label: c.name,
        reason: `${pct(c.spamShare)} spam, ~${usd(c.spendOnSpam)} on spam${c.costPerGoodLead !== null ? `, ${usd(c.costPerGoodLead)} per good lead` : ", no good leads"}.`,
      });
    } else if (!c.wasteful && c.heuristicAction === "scale" && c.humanDecision !== "scale") {
      candidates.push({
        action: "scale_campaign",
        campaignId: c.campaignId,
        label: c.name,
        reason: `${c.nHot} hot leads, ${pct(c.spamShare)} spam${c.costPerHot !== null ? `, ${usd(c.costPerHot)} per hot lead` : ""}.`,
      });
    }
  }
  const out: WasteProposal[] = [];
  for (const p of candidates.slice(0, MAX_PROPOSALS)) {
    // canAutoRun:false makes this structurally unable to execute — it can only return a proposal.
    const outcome = await runWithPolicy(
      marketingActions,
      { action: p.action, summary: p.reason, targets: [{ id: p.campaignId, label: p.label }] },
      { actor: "Helix waste report" },
      { canAutoRun: false }
    );
    const reasons = "reasons" in outcome ? outcome.reasons : [];
    out.push({ ...p, risk: "confirm", riskReasons: reasons });
  }
  return out;
}

/** Every number the model is allowed to quote, in the formats it is likely to write them. */
function allowedNumbers(payload: unknown): Set<string> {
  const allowed = new Set<string>();
  const add = (n: number) => {
    for (const v of [n, r2(n), Math.round(n), Math.round(n * 10) / 10]) allowed.add(String(v));
    if (n > 0 && n <= 1) {
      allowed.add(String(Math.round(n * 100)));
      allowed.add(String(Math.round(n * 1000) / 10));
    }
  };
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) add(v);
    else if (typeof v === "string") for (const m of v.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(String(Number(m)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(payload);
  return allowed;
}

export function findUnverifiedNumbers(text: string, payload: unknown): string[] {
  const allowed = allowedNumbers(payload);
  const found = text.replace(/,(?=\d{3})/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.filter((n) => !allowed.has(String(Number(n)))))];
}

type ClaudeExplanation = { narrative: WasteNarrative; inputTokens: number; outputTokens: number; unverified: string[] };

const SYSTEM_PROMPT = [
  "You are a paid-media analyst writing for a marketing operator.",
  "You receive campaign metrics already computed by code: spend joined with lead quality (spam share, cost per good lead).",
  "Explain which campaigns waste money and why, in plain English, 1-2 sentences per campaign.",
  "Rules: quote ONLY numbers that appear in the input, exactly as given. Never compute, estimate, or invent numbers or metrics.",
  "Only discuss campaigns flagged wasteful:true. Do not recommend anything beyond pausing or reviewing; a human decides.",
  'Reply with JSON only: {"summary": string, "campaigns": [{"campaignId": string, "why": string}]}',
].join("\n");

export async function explainWithClaude(m: WasteMetrics, fetchImpl: typeof fetch = fetch): Promise<ClaudeExplanation | null> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return null;
  const payload = {
    window: { from: m.from, to: m.to },
    totals: {
      totalSpend: m.totalSpend,
      spendOnSpam: m.spendOnSpam,
      wastePct: m.wastePct,
      leads: m.nLeads,
      spamLeads: m.nSpam,
      goodLeads: m.nGood,
      blendedCostPerGoodLead: m.blendedCostPerGoodLead,
      unjudgedSpend: m.unjudgedSpend,
    },
    thresholds: { minLeadsForVerdict: MIN_LEADS_FOR_VERDICT, spamHeavyShare: SPAM_HEAVY_SHARE, expensiveMultiplier: EXPENSIVE_GOOD_LEAD_MULTIPLIER },
    campaigns: m.campaigns.slice(0, 25).map((c) => ({
      campaignId: c.campaignId,
      name: c.name,
      platform: c.sourceLabel,
      spend: c.spend,
      leads: c.nLeads,
      spamLeads: c.nSpam,
      goodLeads: c.nGood,
      spamShare: c.spamShare,
      spendOnSpam: c.spendOnSpam,
      costPerGoodLead: c.costPerGoodLead,
      flags: c.flags,
      wasteful: c.wasteful,
    })),
  };

  let res: Response;
  try {
    res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  } | null;
  const inputTokens = data?.usage?.input_tokens ?? 0;
  const outputTokens = data?.usage?.output_tokens ?? 0;
  if (inputTokens || outputTokens) recordAiUsage({ feature: "waste_report", inputTokens, outputTokens });

  const text = data?.content?.find((c) => c.type === "text")?.text ?? "";
  const parsed = parseJsonObject<{ summary?: unknown; campaigns?: unknown }>(text);
  if (!parsed || typeof parsed.summary !== "string") return null;

  const known = new Map(m.campaigns.map((c) => [c.campaignId, c]));
  const campaigns = (Array.isArray(parsed.campaigns) ? parsed.campaigns : [])
    .map((x) => x as { campaignId?: unknown; why?: unknown })
    .filter((x) => typeof x.campaignId === "string" && typeof x.why === "string" && known.has(x.campaignId))
    .map((x) => ({ campaignId: x.campaignId as string, name: known.get(x.campaignId as string)!.name, why: (x.why as string).slice(0, 600) }));

  const narrative = { summary: parsed.summary.slice(0, 1200), campaigns };
  const allText = [narrative.summary, ...campaigns.map((c) => c.why)].join(" ");
  return { narrative, inputTokens, outputTokens, unverified: findUnverifiedNumbers(allText, payload) };
}

const REPORT_FILE = "waste-report.json";

export async function generateWasteReport(opts: {
  window?: MarketingWindow;
  trigger: WasteReport["trigger"];
  fetchImpl?: typeof fetch;
}): Promise<WasteReport> {
  const snapshot = await getSnapshot(opts.window ?? "7d");
  const decisions = new Map<string, CampaignAction>();
  for (const c of snapshot.campaigns) {
    const d = await getDecision(c.campaignId);
    if (d) decisions.set(c.campaignId, d.action);
  }
  const metrics = computeWasteMetrics(snapshot, decisions);
  const deterministic = deterministicNarrative(metrics);
  const proposals = await buildProposals(metrics);

  const hasKey = Boolean(getSecret("ANTHROPIC_API_KEY"));
  const ai = metrics.totalSpend > 0 ? await explainWithClaude(metrics, opts.fetchImpl ?? fetch) : null;

  let engineNote: string;
  if (ai) engineNote = "Explained by Claude from metrics computed in code. Numbers come from your spend and scored leads.";
  else if (!hasKey) engineNote = "Deterministic analysis (no AI): add ANTHROPIC_API_KEY for a Claude explanation. Numbers are the same.";
  else if (metrics.totalSpend <= 0) engineNote = "Deterministic analysis: no joined spend to explain, so Claude was not called.";
  else engineNote = "Deterministic analysis: the Claude call failed or returned an unreadable answer.";

  const report: WasteReport = {
    generatedAt: new Date().toISOString(),
    trigger: opts.trigger,
    dataKind: currentDeskMode(),
    engine: ai ? "claude" : "deterministic",
    engineNote,
    metrics,
    narrative: ai?.narrative ?? deterministic,
    deterministic,
    unverifiedNumbers: ai?.unverified ?? [],
    proposals,
    aiCost: ai
      ? {
          inputTokens: ai.inputTokens,
          outputTokens: ai.outputTokens,
          estimatedUsd: estimateClaudeCostUsd(ai.inputTokens, ai.outputTokens),
          isEstimate: true,
        }
      : null,
    sources: getAllSourceStatus(),
  };
  saveLatestReport(report);
  return report;
}

function saveLatestReport(report: WasteReport): void {
  (globalThis as { __helixMarketingWasteReport?: WasteReport }).__helixMarketingWasteReport = report;
  // Demo reports stay in memory only, like demo desk data.
  if (report.dataKind === "live") writeJsonFile(REPORT_FILE, report);
}

/** Latest report for the current desk mode only — a demo report is never shown on a live desk. */
export function getLatestWasteReport(): WasteReport | null {
  const g = globalThis as { __helixMarketingWasteReport?: WasteReport };
  const report = g.__helixMarketingWasteReport ?? readJsonFile<WasteReport>(REPORT_FILE);
  if (!report || report.dataKind !== currentDeskMode()) return null;
  return report;
}
