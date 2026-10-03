import { getSecret } from "@helix/core";

/**
 * Token + cost ledger for every Claude call the Inbox desk makes itself.
 * Prices are ESTIMATES copied from Anthropic's public list price (USD per million tokens) and
 * can drift; the desk always labels these totals "estimated". The ledger lives in this server
 * process only, so a cold start or a different serverless instance (e.g. the cron) starts at zero.
 */

export const INBOX_CLAUDE_MODEL = "claude-sonnet-4-20250514";

export const ESTIMATED_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
};
/** Used when a model is not in the table above — priced like Sonnet so the estimate errs high. */
export const ESTIMATED_FALLBACK_USD_PER_MTOK = { input: 3, output: 15 };

export type AiUsagePurpose = "triage" | "draft" | "agent" | "smart_reply";

export type AiUsageEntry = {
  at: string;
  purpose: AiUsagePurpose;
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
  byPurpose: Record<string, { calls: number; estimatedUsd: number }>;
  since: string;
  estimated: true;
  scope: "this-server-instance";
};

type Ledger = { entries: AiUsageEntry[]; since: string };

function ledger(): Ledger {
  const g = globalThis as typeof globalThis & { __helixInboxAiUsage?: Ledger };
  if (!g.__helixInboxAiUsage) g.__helixInboxAiUsage = { entries: [], since: new Date().toISOString() };
  return g.__helixInboxAiUsage;
}

export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = ESTIMATED_USD_PER_MTOK[model] ?? ESTIMATED_FALLBACK_USD_PER_MTOK;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export function recordAiUsage(purpose: AiUsagePurpose, model: string, usage: { input_tokens?: number; output_tokens?: number } | undefined): AiUsageEntry {
  const inputTokens = Math.max(0, Number(usage?.input_tokens ?? 0)) || 0;
  const outputTokens = Math.max(0, Number(usage?.output_tokens ?? 0)) || 0;
  const entry: AiUsageEntry = {
    at: new Date().toISOString(),
    purpose,
    model,
    inputTokens,
    outputTokens,
    estimatedUsd: estimateUsd(model, inputTokens, outputTokens),
  };
  const l = ledger();
  l.entries.push(entry);
  if (l.entries.length > 2000) l.entries.splice(0, l.entries.length - 2000);
  return entry;
}

export function summarizeAiUsage(entries: AiUsageEntry[] = ledger().entries): AiUsageTotals {
  const byPurpose: AiUsageTotals["byPurpose"] = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedUsd = 0;
  for (const e of entries) {
    inputTokens += e.inputTokens;
    outputTokens += e.outputTokens;
    estimatedUsd += e.estimatedUsd;
    const p = (byPurpose[e.purpose] ??= { calls: 0, estimatedUsd: 0 });
    p.calls += 1;
    p.estimatedUsd += e.estimatedUsd;
  }
  return {
    calls: entries.length,
    inputTokens,
    outputTokens,
    estimatedUsd,
    byPurpose,
    since: ledger().since,
    estimated: true,
    scope: "this-server-instance",
  };
}

export function resetAiUsage() {
  const l = ledger();
  l.entries.length = 0;
  l.since = new Date().toISOString();
}

export type ClaudeBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

/**
 * One Anthropic Messages call that always records usage. Throws on a missing key or a non-2xx
 * response, so callers decide (visibly) what to fall back to.
 */
export async function claudeMessages(params: {
  purpose: AiUsagePurpose;
  model?: string;
  maxTokens: number;
  system?: string;
  messages: unknown[];
  tools?: unknown[];
  timeoutMs?: number;
}): Promise<{ content: ClaudeBlock[]; text: string; stopReason?: string }> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  const model = params.model ?? INBOX_CLAUDE_MODEL;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens,
      ...(params.system ? { system: params.system } : {}),
      messages: params.messages,
      ...(params.tools?.length ? { tools: params.tools } : {}),
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    content?: ClaudeBlock[];
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Anthropic request failed (${res.status})${data.error?.message ? `: ${data.error.message}` : ""}`);
  recordAiUsage(params.purpose, model, data.usage);
  const content = data.content ?? [];
  const text = content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { content, text, stopReason: data.stop_reason };
}
