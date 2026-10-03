/**
 * ESTIMATES ONLY. USD per million tokens, copied from Anthropic's public list prices.
 * They are not read from your invoice: discounts, batch pricing, caching and price changes
 * are not reflected. Update these constants when Anthropic changes its pricing.
 */
export const ESTIMATED_PRICE_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
};

/** Used for a model missing from the table above, so an unknown model is never shown as free. */
export const FALLBACK_PRICE_USD_PER_MTOK = { input: 3, output: 15 };

export type ClaudeCallPurpose = "triage" | "next_move" | "outreach";

export type ClaudeCallRecord = {
  at: string;
  model: string;
  purpose: ClaudeCallPurpose;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  priceKnown: boolean;
  error?: string;
};

export type AiCostSummary = {
  calls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  byModel: { model: string; calls: number; inputTokens: number; outputTokens: number; estimatedUsd: number; priceKnown: boolean }[];
  byPurpose: { purpose: ClaudeCallPurpose; calls: number; estimatedUsd: number }[];
  lastCall: ClaudeCallRecord | null;
  since: string;
};

const MAX_RECORDS = 500;

const g = globalThis as { __helixLeadsAiCalls?: ClaudeCallRecord[]; __helixLeadsAiSince?: string };

function ledger(): ClaudeCallRecord[] {
  if (!g.__helixLeadsAiCalls) {
    g.__helixLeadsAiCalls = [];
    g.__helixLeadsAiSince = new Date().toISOString();
  }
  return g.__helixLeadsAiCalls;
}

export function estimateUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): { usd: number; priceKnown: boolean } {
  const known = ESTIMATED_PRICE_USD_PER_MTOK[model];
  const price = known ?? FALLBACK_PRICE_USD_PER_MTOK;
  const usd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return { usd, priceKnown: Boolean(known) };
}

export function recordClaudeCall(input: Omit<ClaudeCallRecord, "at" | "estimatedUsd" | "priceKnown">): ClaudeCallRecord {
  const { usd, priceKnown } = estimateUsd(input.model, input.inputTokens, input.outputTokens);
  const record: ClaudeCallRecord = {
    ...input,
    at: new Date().toISOString(),
    estimatedUsd: usd,
    priceKnown,
  };
  const list = ledger();
  list.push(record);
  if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
  return record;
}

export function getAiCostSummary(): AiCostSummary {
  const list = ledger();
  const byModel = new Map<string, AiCostSummary["byModel"][number]>();
  const byPurpose = new Map<ClaudeCallPurpose, AiCostSummary["byPurpose"][number]>();
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedUsd = 0;
  let failedCalls = 0;
  for (const r of list) {
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    estimatedUsd += r.estimatedUsd;
    if (!r.ok) failedCalls += 1;
    const m = byModel.get(r.model) ?? {
      model: r.model,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedUsd: 0,
      priceKnown: r.priceKnown,
    };
    m.calls += 1;
    m.inputTokens += r.inputTokens;
    m.outputTokens += r.outputTokens;
    m.estimatedUsd += r.estimatedUsd;
    byModel.set(r.model, m);
    const p = byPurpose.get(r.purpose) ?? { purpose: r.purpose, calls: 0, estimatedUsd: 0 };
    p.calls += 1;
    p.estimatedUsd += r.estimatedUsd;
    byPurpose.set(r.purpose, p);
  }
  return {
    calls: list.length,
    failedCalls,
    inputTokens,
    outputTokens,
    estimatedUsd,
    byModel: [...byModel.values()],
    byPurpose: [...byPurpose.values()],
    lastCall: list.at(-1) ?? null,
    since: g.__helixLeadsAiSince ?? new Date().toISOString(),
  };
}

export function resetAiCostLedger(): void {
  g.__helixLeadsAiCalls = [];
  g.__helixLeadsAiSince = new Date().toISOString();
}
