import type { EmailThread, ThreadMessage } from "@/lib/types";
import { smartReplyHeuristic } from "@/lib/triage";
import { getAgentProfile } from "@/lib/agent-profile";
import { queryInboxKb } from "@/lib/kb-store";
import { getSecret } from "@helix/core";
import { claudeMessages } from "@/lib/ai-usage";

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
  history: ThreadMessage[],
  opts?: { heuristicOnly?: boolean }
): Promise<{ draftReply: string; engine: "claude" | "heuristic"; confidence: number; reasoning?: string }> {
  const fallback = smartReplyHeuristic({
    fromName: thread.fromName,
    subject: thread.subject,
    body: thread.body,
    category: thread.category,
    sentiment: thread.sentiment,
    prior: history,
  });

  const key = getSecret("ANTHROPIC_API_KEY");
  const profile = getAgentProfile();
  const persona =
    profile.persona === "sales"
      ? "You are the Sales desk. Qualify buyer intent, name the next commercial step, and do not invent prices."
      : "You are the Executive desk. Filter noise, summarize the ask, and propose a meeting only when one was requested.";
  const hits = queryInboxKb({ subject: thread.subject, body: thread.body }, 3);
  const sources = hits.map((hit) => `${hit.docTitle}: ${hit.quote || hit.excerpt}`).join("\n");
  if (!key || opts?.heuristicOnly || thread.category === "spam" || thread.category === "fyi") {
    return { draftReply: fallback, engine: "heuristic", confidence: thread.aiConfidence || 62 };
  }

  try {
    const priorBlock = history
      .slice(-6)
      .map((m) => `- ${m.fromEmail} @ ${m.sentAt}: ${m.body.slice(0, 400)}`)
      .join("\n");
    const { text } = await claudeMessages({
      purpose: "smart_reply",
      model: profile.model,
      maxTokens: 500,
      timeoutMs: 20_000,
      messages: [
        {
          role: "user",
          content: `You are Helix for Inbox. Draft a short professional reply (max 60 words).
${persona}
Use only the company sources below. If they do not contain a price or term, say you will confirm it. Do not invent figures.
${profile.prompt ? `Company voice:\n${profile.prompt}\n` : ""}
Sources:
${sources || "(none)"}
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
    });
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
