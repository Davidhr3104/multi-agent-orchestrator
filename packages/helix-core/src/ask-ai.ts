import { getSecret } from "./secrets";

export type AskAiRole = "user" | "assistant";
export type AskAiMessage = { role: AskAiRole; content: string };
export type AskAiEngine = "claude" | "fallback";
export type AskAiResult = { answer: string; engine: AskAiEngine };

const UNAVAILABLE_MESSAGE =
  "Ask AI needs an Anthropic API key configured to answer questions.";

function fallback(recordContext?: string): AskAiResult {
  return { answer: recordContext ?? UNAVAILABLE_MESSAGE, engine: "fallback" };
}

export async function askAi(params: {
  systemPrompt: string;
  recordContext?: string;
  history: AskAiMessage[];
}): Promise<AskAiResult> {
  const { systemPrompt, recordContext, history } = params;
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return fallback(recordContext);

  const system = recordContext ? `${systemPrompt}\n\n${recordContext}` : systemPrompt;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        system,
        messages: history,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return fallback(recordContext);

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text) return fallback(recordContext);

    return { answer: text, engine: "claude" };
  } catch {
    return fallback(recordContext);
  }
}
