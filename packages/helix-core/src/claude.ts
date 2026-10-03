import { readClaudeUsage, reportClaudeUsage, type ClaudeUsage } from "./claude-usage";
import { getSecret } from "./secrets";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";

export function isClaudeConfigured(): boolean {
  return Boolean(getSecret("ANTHROPIC_API_KEY"));
}

/** Like completeWithClaude(), but also returns the token usage of the call. */
export async function completeWithClaudeDetailed(
  prompt: string,
  opts: { maxTokens?: number; model?: string; feature?: string } = {}
): Promise<{ text: string; usage?: ClaudeUsage } | null> {
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return null;
  const model = opts.model ?? DEFAULT_CLAUDE_MODEL;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 900,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const usage = readClaudeUsage(data, model, opts.feature ?? "complete");
    if (usage) reportClaudeUsage(usage);
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    return text ? { text, usage } : null;
  } catch {
    return null;
  }
}

export async function completeWithClaude(
  prompt: string,
  maxTokens = 900
): Promise<string | null> {
  return (await completeWithClaudeDetailed(prompt, { maxTokens }))?.text ?? null;
}

export function parseJsonObject<T>(raw: string): T | null {
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
