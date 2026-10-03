import { getSecret } from "@helix/core";
import { CLAUDE_MODEL, recordAiUsage, type AiFeature, type AiUsageEntry } from "./ai-usage";

/**
 * The desk's own Claude call, so every request records its token use (see ai-usage.ts). Same model and API
 * as @helix/core's askAi(); without ANTHROPIC_API_KEY nothing is called and callers fall back to templates.
 */

export const claudeReady = () => Boolean(getSecret("ANTHROPIC_API_KEY"));

export type ClaudeOk = { ok: true; text: string; usage: AiUsageEntry };
export type ClaudeFail = { ok: false; error: string };

export async function callClaude(input: { feature: AiFeature; system: string; prompt: string; maxTokens?: number; fetchImpl?: typeof fetch }): Promise<ClaudeOk | ClaudeFail> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, error: "No Anthropic API key is set on this server." };
  const doFetch = input.fetchImpl ?? fetch;
  try {
    const res = await doFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: input.maxTokens ?? 700, system: input.system, messages: [{ role: "user", content: input.prompt }] }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return { ok: false, error: `Claude answered ${res.status}.` };
    const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const usage = recordAiUsage({
      feature: input.feature,
      model: CLAUDE_MODEL,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      ok: true,
    });
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text) return { ok: false, error: "Claude returned no text." };
    return { ok: true, text, usage };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "TimeoutError" ? "Claude took too long to answer." : "Couldn't reach Claude." };
  }
}

export function parseJson<T>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const numbersIn = (text: string) =>
  (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((t) => Number(t.replace(/,/g, ""))).filter((n) => Number.isFinite(n));

/**
 * Figures in the model's text that don't appear in the facts it was given (allowing "$485k" / "1.2 million"
 * shorthands). Used to discard any AI text that invents a price, size or market number.
 */
export function inventedNumbers(text: string, facts: string): number[] {
  const allowed = numbersIn(facts);
  const ok = (t: number) =>
    allowed.some((a) => a === t || Math.abs(a / 1_000 - t) < 0.051 || Math.abs(a / 1_000_000 - t) < 0.051 || Math.abs(Math.round(a) - t) < 0.001);
  return [...new Set(numbersIn(text).filter((t) => !ok(t)))];
}
