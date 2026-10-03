export const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/**
 * ESTIMATES, not billing data: Anthropic's published list price for Claude Sonnet 4 in USD per million
 * tokens. Real invoices can differ (discounts, batch, caching, price changes) — always label as "estimated".
 */
export const CLAUDE_INPUT_USD_PER_MTOK_ESTIMATE = 3;
export const CLAUDE_OUTPUT_USD_PER_MTOK_ESTIMATE = 15;

export type AiPurpose = "extraction" | "go-no-go" | "coi";

export type AiUsageEntry = {
  id: string;
  at: string;
  purpose: AiPurpose;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  rfpId?: string;
};

export type AiCostSummary = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
};

export function estimateClaudeUsd(inputTokens: number, outputTokens: number): number {
  const usd =
    (Math.max(0, inputTokens) / 1_000_000) * CLAUDE_INPUT_USD_PER_MTOK_ESTIMATE +
    (Math.max(0, outputTokens) / 1_000_000) * CLAUDE_OUTPUT_USD_PER_MTOK_ESTIMATE;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function usageEntry(input: {
  purpose: AiPurpose;
  inputTokens: number;
  outputTokens: number;
  model?: string;
  rfpId?: string;
  at?: string;
}): AiUsageEntry {
  const inputTokens = Math.max(0, Math.round(Number(input.inputTokens) || 0));
  const outputTokens = Math.max(0, Math.round(Number(input.outputTokens) || 0));
  return {
    id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: input.at ?? new Date().toISOString(),
    purpose: input.purpose,
    model: input.model ?? CLAUDE_MODEL,
    inputTokens,
    outputTokens,
    estimatedUsd: estimateClaudeUsd(inputTokens, outputTokens),
    rfpId: input.rfpId,
  };
}

export function summarizeUsage(entries: readonly AiUsageEntry[] | undefined): AiCostSummary {
  const list = entries ?? [];
  const sum = list.reduce(
    (acc, e) => ({
      calls: acc.calls + 1,
      inputTokens: acc.inputTokens + e.inputTokens,
      outputTokens: acc.outputTokens + e.outputTokens,
      estimatedUsd: acc.estimatedUsd + e.estimatedUsd,
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
  );
  return { ...sum, estimatedUsd: Math.round(sum.estimatedUsd * 1_000_000) / 1_000_000 };
}

export function summarizeDeskUsage(rfps: readonly { aiUsage?: AiUsageEntry[] }[]): AiCostSummary {
  return summarizeUsage(rfps.flatMap((r) => r.aiUsage ?? []));
}

export function formatUsdEstimate(usd: number): string {
  if (usd <= 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
