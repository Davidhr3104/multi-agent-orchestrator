import { getSecret } from "@helix/core";
import { CLAUDE_MODEL, usageEntry, type AiPurpose, type AiUsageEntry } from "@/lib/ai-cost";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export type MeteredFailure = "not_configured" | "rate_limited" | "http_error" | "network" | "empty";

export type MeteredResult =
  | { ok: true; text: string; usage: AiUsageEntry }
  | { ok: false; reason: MeteredFailure; status?: number; message: string; usage?: AiUsageEntry };

export function isClaudeKeySet(): boolean {
  return Boolean(getSecret("ANTHROPIC_API_KEY"));
}

/**
 * Same request as @helix/core's completeWithClaude, but keeps the `usage` block Anthropic returns so every
 * call made by the Legal desk can be shown with its tokens and estimated cost.
 */
export async function callClaudeMetered(opts: {
  prompt: string;
  purpose: AiPurpose;
  maxTokens?: number;
  rfpId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MeteredResult> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, reason: "not_configured", message: "ANTHROPIC_API_KEY is not set." };
  const doFetch = opts.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: opts.maxTokens ?? 900,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
    });
  } catch (err) {
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "Network error" };
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: res.status === 429 ? "rate_limited" : "http_error",
      status: res.status,
      message: res.status === 429 ? "Anthropic rate limit reached." : `Anthropic returned HTTP ${res.status}.`,
    };
  }

  let data: {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, reason: "empty", status: res.status, message: "Anthropic response was not JSON." };
  }

  const usage = usageEntry({
    purpose: opts.purpose,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    model: data.model ?? CLAUDE_MODEL,
    rfpId: opts.rfpId,
  });
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!text) return { ok: false, reason: "empty", status: res.status, message: "Claude returned no text.", usage };
  return { ok: true, text, usage };
}
