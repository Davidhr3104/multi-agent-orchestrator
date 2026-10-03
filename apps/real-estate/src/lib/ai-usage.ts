/**
 * Token use and an ESTIMATED cost for every Claude call this server made. The prices are Anthropic's public list
 * prices for the model at the time of writing, not your invoice: check the Anthropic console for what you were billed.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-20250514";
export const EST_USD_PER_MILLION_INPUT_TOKENS = 3;
export const EST_USD_PER_MILLION_OUTPUT_TOKENS = 15;

export type AiFeature = "listing_copy" | "match_alert" | "market_brief" | "nightly_match";
export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  listing_copy: "Listing copy",
  match_alert: "Match explanations & alerts",
  market_brief: "Market brief",
  nightly_match: "Nightly matching",
};

export type AiUsageEntry = { at: string; feature: AiFeature; model: string; inputTokens: number; outputTokens: number; estUsd: number; ok: boolean };
export type AiUsageTotals = { calls: number; inputTokens: number; outputTokens: number; estUsd: number; byFeature: Partial<Record<AiFeature, { calls: number; estUsd: number }>> };

const CAP = 1000;

function ledger(): AiUsageEntry[] {
  const g = globalThis as typeof globalThis & { __helixReAiUsage?: AiUsageEntry[] };
  g.__helixReAiUsage ??= [];
  return g.__helixReAiUsage;
}

export function estimateUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * EST_USD_PER_MILLION_INPUT_TOKENS + outputTokens * EST_USD_PER_MILLION_OUTPUT_TOKENS) / 1_000_000;
}

export function recordAiUsage(e: Omit<AiUsageEntry, "at" | "estUsd">): AiUsageEntry {
  const entry: AiUsageEntry = { ...e, at: new Date().toISOString(), estUsd: estimateUsd(e.inputTokens, e.outputTokens) };
  const l = ledger();
  l.unshift(entry);
  if (l.length > CAP) l.length = CAP;
  return entry;
}

export function aiUsageTotals(): AiUsageTotals {
  const totals: AiUsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0, estUsd: 0, byFeature: {} };
  for (const e of ledger()) {
    totals.calls++;
    totals.inputTokens += e.inputTokens;
    totals.outputTokens += e.outputTokens;
    totals.estUsd += e.estUsd;
    const f = (totals.byFeature[e.feature] ??= { calls: 0, estUsd: 0 });
    f.calls++;
    f.estUsd += e.estUsd;
  }
  return totals;
}

export function listAiUsage(): AiUsageEntry[] {
  return ledger().map((e) => ({ ...e }));
}

export function resetAiUsage(): void {
  ledger().length = 0;
}

/** "$0.0042" for small amounts, "$1.27" otherwise. Always shown with the word "estimated" next to it. */
export const fmtUsd = (n: number) => (n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
