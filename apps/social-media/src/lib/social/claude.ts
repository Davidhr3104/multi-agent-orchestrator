import { getSecret } from "@helix/core";
import type { FetchLike } from "./config";

export const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/** ESTIMATE. Anthropic list price for Claude Sonnet 4 in USD per million input tokens. Not read from a bill. */
export const EST_INPUT_USD_PER_MTOK = 3;
/** ESTIMATE. Anthropic list price for Claude Sonnet 4 in USD per million output tokens. Not read from a bill. */
export const EST_OUTPUT_USD_PER_MTOK = 15;

export type AiCallRecord = {
  id: string;
  at: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated from the token counts Anthropic returned and the constants above. */
  estUsd: number;
};

export type AiUsageTotals = { calls: number; inputTokens: number; outputTokens: number; estUsd: number; recent: AiCallRecord[] };

export class ClaudeUnavailableError extends Error {}

type Ledger = { calls: AiCallRecord[] };

function ledger(): Ledger {
  const g = globalThis as typeof globalThis & { __helixSocialAiLedger?: Ledger };
  g.__helixSocialAiLedger ??= { calls: [] };
  return g.__helixSocialAiLedger;
}

export function estimateUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * EST_INPUT_USD_PER_MTOK + outputTokens * EST_OUTPUT_USD_PER_MTOK) / 1_000_000;
}

export function aiUsageTotals(): AiUsageTotals {
  const calls = ledger().calls;
  return {
    calls: calls.length,
    inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
    outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
    estUsd: calls.reduce((s, c) => s + c.estUsd, 0),
    recent: calls.slice(0, 10).map((c) => ({ ...c })),
  };
}

export function resetAiLedger() {
  ledger().calls = [];
}

export function claudeConfigured(): boolean {
  return Boolean(getSecret("ANTHROPIC_API_KEY"));
}

/** One Messages API call that records the token usage Anthropic reports. Throws when Claude is not configured or the call fails. */
export async function callClaude(params: { purpose: string; system: string; prompt: string; maxTokens?: number }, fetchImpl: FetchLike = fetch): Promise<{ text: string; call: AiCallRecord }> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) throw new ClaudeUnavailableError("Claude needs ANTHROPIC_API_KEY on this deployment.");
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: params.maxTokens ?? 1200, system: params.system, messages: [{ role: "user", content: params.prompt }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new ClaudeUnavailableError(`Claude answered ${res.status}.`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const call: AiCallRecord = {
    id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    purpose: params.purpose,
    inputTokens,
    outputTokens,
    estUsd: estimateUsd(inputTokens, outputTokens),
  };
  const l = ledger();
  l.calls.unshift(call);
  l.calls = l.calls.slice(0, 500);
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new ClaudeUnavailableError("Claude returned no text.");
  return { text, call };
}
