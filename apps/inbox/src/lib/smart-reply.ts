import type { EmailThread, ThreadMessage } from "@/lib/types";
import { smartReplyHeuristic } from "@/lib/triage";

type ClaudeReplyJson = {
  draftReply?: string;
  category?: string;
  sentiment?: string;
  urgencyScore?: number;
  confidence?: number;
  reasoning?: string;
};

export async function smartReplyWithContext(
  thread: EmailThread,
  history: ThreadMessage[]
): Promise<{ draftReply: string; engine: "claude" | "heuristic"; confidence: number; reasoning?: string }> {
  const fallback = smartReplyHeuristic({
    fromName: thread.fromName,
    subject: thread.subject,
    body: thread.body,
    category: thread.category,
    sentiment: thread.sentiment,
    prior: history,
  });

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || thread.category === "spam" || thread.category === "fyi") {
    return { draftReply: fallback, engine: "heuristic", confidence: thread.aiConfidence || 62 };
  }

  try {
    const priorBlock = history
      .slice(-6)
      .map((m) => `- ${m.fromEmail} @ ${m.sentAt}: ${m.body.slice(0, 400)}`)
      .join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `You are Helix for Inbox. Draft a short professional reply (max 60 words).
Return ONLY JSON: {"draftReply":"...","confidence":0-100,"reasoning":"..."}
Tone: calm ops EA. Money format $85,000. Dates ISO if any.
Category=${thread.category} Sentiment=${thread.sentiment} Urgency=${thread.urgencyScore}
Subject: ${thread.subject}
From: ${thread.fromName} <${thread.fromEmail}>
Body:
${thread.body.slice(0, 2500)}
Prior messages:
${priorBlock || "(none)"}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const payload = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = payload.content?.find((c) => c.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");
    const parsed = JSON.parse(match[0]) as ClaudeReplyJson;
    const draft = parsed.draftReply?.trim();
    if (!draft) throw new Error("Empty draft");
    return {
      draftReply: draft,
      engine: "claude",
      confidence: Number(parsed.confidence ?? 82),
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    console.warn("[helix-inbox] smart reply fallback:", err instanceof Error ? err.message : err);
    return { draftReply: fallback, engine: "heuristic", confidence: thread.aiConfidence || 55 };
  }
}
