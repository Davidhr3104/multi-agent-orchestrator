import { getSecret, parseJsonObject } from "@helix/core";
import { recordClaudeCall, type ClaudeCallPurpose } from "./ai-cost";

/** Cheap, fast model for per-lead classification. Change it here only. */
export const TRIAGE_MODEL = "claude-haiku-4-5";
/** Model for the written next-best-move draft (same model the shared core already uses). */
export const DRAFT_MODEL = "claude-sonnet-4-20250514";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function isAnthropicConfigured(): boolean {
  return Boolean(getSecret("ANTHROPIC_API_KEY"));
}

export type ClaudeResult =
  | { ok: true; text: string; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; error: string; model: string };

/**
 * One Messages API call. Every attempt that reaches Anthropic is written to the cost ledger
 * with the token counts the API itself reported (failed calls cost 0 tokens).
 */
export async function callClaude(params: {
  model: string;
  purpose: ClaudeCallPurpose;
  system?: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<ClaudeResult> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY is not set", model: params.model };

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 600,
        ...(params.system ? { system: params.system } : {}),
        messages: [{ role: "user", content: params.prompt }],
      }),
      signal: AbortSignal.timeout(params.timeoutMs ?? 20_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
    };
    const inputTokens = Number(data.usage?.input_tokens) || 0;
    const outputTokens = Number(data.usage?.output_tokens) || 0;
    if (!res.ok) {
      const error = data.error?.message || `Anthropic HTTP ${res.status}`;
      recordClaudeCall({ model: params.model, purpose: params.purpose, ok: false, inputTokens, outputTokens, error });
      return { ok: false, error, model: params.model };
    }
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    recordClaudeCall({ model: params.model, purpose: params.purpose, ok: Boolean(text), inputTokens, outputTokens });
    if (!text) return { ok: false, error: "Claude returned no text", model: params.model };
    return { ok: true, text, model: params.model, inputTokens, outputTokens };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error, model: params.model };
  }
}

export async function callClaudeJson<T>(
  params: Parameters<typeof callClaude>[0]
): Promise<{ ok: true; data: T; model: string } | { ok: false; error: string; model: string }> {
  const result = await callClaude(params);
  if (!result.ok) return result;
  const data = parseJsonObject<T>(result.text);
  if (!data) return { ok: false, error: "Claude returned invalid JSON", model: result.model };
  return { ok: true, data, model: result.model };
}
