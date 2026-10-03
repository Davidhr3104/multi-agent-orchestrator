import { readJsonFile, writeJsonFile } from "@/lib/desk-files";

/**
 * Token usage and ESTIMATED USD cost of the Claude calls this app makes directly.
 * Prices are Anthropic list prices for Claude Sonnet 4 at the time of writing — an estimate, not an
 * invoice. Check console.anthropic.com for the real bill.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-20250514";
export const ESTIMATED_USD_PER_MILLION_INPUT_TOKENS = 3;
export const ESTIMATED_USD_PER_MILLION_OUTPUT_TOKENS = 15;

const MAX_ENTRIES = 500;
const FILE = "ai-usage.json";

export type AiUsageEntry = {
  at: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
};

export type AiUsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  since: string | null;
  isEstimate: true;
  pricing: { inputPerMillion: number; outputPerMillion: number; model: string };
};

export function estimateClaudeCostUsd(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1_000_000) * ESTIMATED_USD_PER_MILLION_INPUT_TOKENS +
    (outputTokens / 1_000_000) * ESTIMATED_USD_PER_MILLION_OUTPUT_TOKENS;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

function entries(): AiUsageEntry[] {
  const g = globalThis as { __helixMarketingAiUsage?: AiUsageEntry[] };
  if (!g.__helixMarketingAiUsage) g.__helixMarketingAiUsage = readJsonFile<AiUsageEntry[]>(FILE) ?? [];
  return g.__helixMarketingAiUsage;
}

export function resetAiUsage(): void {
  (globalThis as { __helixMarketingAiUsage?: AiUsageEntry[] }).__helixMarketingAiUsage = [];
}

export function recordAiUsage(input: { feature: string; model?: string; inputTokens: number; outputTokens: number }): AiUsageEntry {
  const inputTokens = Math.max(0, Math.round(input.inputTokens || 0));
  const outputTokens = Math.max(0, Math.round(input.outputTokens || 0));
  const entry: AiUsageEntry = {
    at: new Date().toISOString(),
    feature: input.feature,
    model: input.model ?? CLAUDE_MODEL,
    inputTokens,
    outputTokens,
    estimatedUsd: estimateClaudeCostUsd(inputTokens, outputTokens),
  };
  const list = entries();
  list.unshift(entry);
  list.splice(MAX_ENTRIES);
  writeJsonFile(FILE, list);
  return entry;
}

export function getAiUsageTotals(): AiUsageTotals {
  const list = entries();
  return {
    calls: list.length,
    inputTokens: list.reduce((s, e) => s + e.inputTokens, 0),
    outputTokens: list.reduce((s, e) => s + e.outputTokens, 0),
    estimatedUsd: Math.round(list.reduce((s, e) => s + e.estimatedUsd, 0) * 10_000) / 10_000,
    since: list.length ? list[list.length - 1].at : null,
    isEstimate: true,
    pricing: {
      inputPerMillion: ESTIMATED_USD_PER_MILLION_INPUT_TOKENS,
      outputPerMillion: ESTIMATED_USD_PER_MILLION_OUTPUT_TOKENS,
      model: CLAUDE_MODEL,
    },
  };
}

export function recentAiUsage(limit = 20): AiUsageEntry[] {
  return entries().slice(0, limit);
}
