import { getSecret } from "@helix/core";

export const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/**
 * ESTIMATES, not a bill. List price for Claude Sonnet 4 (USD per million tokens) at the time of
 * writing; Anthropic's invoice is the source of truth. Change these if the pricing changes.
 */
export const ESTIMATED_INPUT_USD_PER_MTOK = 3;
export const ESTIMATED_OUTPUT_USD_PER_MTOK = 15;

export type AiFeature = "fraud_explanation" | "restock_reasoning" | "store_summary";

export type ClaudeUsage = {
  feature: AiFeature;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  at: string;
};

export type AiCostTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  byFeature: Record<AiFeature, { calls: number; estimatedUsd: number }>;
  since: string;
  /** Always true: the dollar figure is computed from list price, not read from Anthropic billing. */
  estimated: true;
};

type Ledger = { entries: ClaudeUsage[]; since: string };

const g = globalThis as { __helixCommerceAiLedger?: Ledger };

function ledger(): Ledger {
  if (!g.__helixCommerceAiLedger) g.__helixCommerceAiLedger = { entries: [], since: new Date().toISOString() };
  return g.__helixCommerceAiLedger;
}

export function estimateUsd(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1_000_000) * ESTIMATED_INPUT_USD_PER_MTOK + (outputTokens / 1_000_000) * ESTIMATED_OUTPUT_USD_PER_MTOK;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function recordUsage(feature: AiFeature, inputTokens: number, outputTokens: number): ClaudeUsage {
  const entry: ClaudeUsage = {
    feature,
    inputTokens,
    outputTokens,
    estimatedUsd: estimateUsd(inputTokens, outputTokens),
    at: new Date().toISOString(),
  };
  const l = ledger();
  l.entries.push(entry);
  if (l.entries.length > 1000) l.entries.splice(0, l.entries.length - 1000);
  return entry;
}

export function getAiCostTotals(): AiCostTotals {
  const l = ledger();
  const byFeature: AiCostTotals["byFeature"] = {
    fraud_explanation: { calls: 0, estimatedUsd: 0 },
    restock_reasoning: { calls: 0, estimatedUsd: 0 },
    store_summary: { calls: 0, estimatedUsd: 0 },
  };
  let inputTokens = 0;
  let outputTokens = 0;
  for (const e of l.entries) {
    inputTokens += e.inputTokens;
    outputTokens += e.outputTokens;
    byFeature[e.feature].calls += 1;
    byFeature[e.feature].estimatedUsd += e.estimatedUsd;
  }
  return {
    calls: l.entries.length,
    inputTokens,
    outputTokens,
    estimatedUsd: estimateUsd(inputTokens, outputTokens),
    byFeature,
    since: l.since,
    estimated: true,
  };
}

export function resetAiCostLedger(): void {
  g.__helixCommerceAiLedger = undefined;
}

export type ClaudeTextResult = { text: string; usage: ClaudeUsage } | { text: null; error: string };

/**
 * One Messages API call that also returns token usage, so every Claude call made by the Commerce
 * insights is metered. Returns { text: null } (never throws) when the key is missing or the call fails.
 */
export async function claudeText(params: {
  feature: AiFeature;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<ClaudeTextResult> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return { text: null, error: "ANTHROPIC_API_KEY not configured" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens ?? 600,
        system: params.system,
        messages: [{ role: "user", content: params.prompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return { text: null, error: `Anthropic HTTP ${res.status}` };
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const usage = recordUsage(params.feature, Number(data.usage?.input_tokens ?? 0), Number(data.usage?.output_tokens ?? 0));
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text) return { text: null, error: "Empty Claude response" };
    return { text, usage };
  } catch (err) {
    return { text: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * The model may only write prose: every number it prints must already exist in the data we sent it.
 * Returns the numbers that do not (empty array = clean). Rounded forms of a source number are allowed.
 */
export function unsupportedNumbers(text: string, sourceData: unknown): number[] {
  const allowed = numbersIn(typeof sourceData === "string" ? sourceData : JSON.stringify(sourceData));
  const ok = (n: number) =>
    allowed.some((a) => Math.abs(a - n) < 0.005 || Math.round(a) === n || Math.round(a * 10) / 10 === n || Math.round(a * 100) / 100 === n);
  return [...new Set(numbersIn(text).filter((n) => !ok(n)))];
}
