import { askAi, type AskAiMessage } from "@helix/core";
import { getMessage } from "@/lib/store";
import type { EmailThread } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Inbox, an EA email triage tool.

How the app works:
- Every inbound email thread is classified into a category (action required, FYI, meeting, spam) and given an urgency score 0-100.
- "Sentiment" reflects the emotional tone the engine detected in the message.
- "Confidence" is how sure the classification engine is about its own category/urgency call.
- "Reasoning" is the engine's explanation for why it classified the thread the way it did.
- Threads flagged "needs review" are held for a human operator before any auto-reply goes out.
- Operators can draft replies, snooze a thread, or hand a thread off to Helix for Leads when buyer intent is detected.

When a specific thread's data is provided below, answer using that data — do not invent facts not present in it. When no thread data is provided, answer only using the description above.`;

function buildRecordContext(thread: EmailThread): string {
  return [
    `Subject: ${thread.subject}`,
    `From: ${thread.fromName} <${thread.fromEmail}>`,
    `Category: ${thread.category}`,
    `Sentiment: ${thread.sentiment}`,
    `Urgency score: ${thread.urgencyScore}`,
    `AI confidence: ${thread.aiConfidence}`,
    `Needs review: ${thread.needsReview}`,
    `Reasoning: ${thread.reasoning}`,
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { threadId?: string; history?: AskAiMessage[] };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  let recordContext: string | undefined;
  if (body.threadId) {
    const message = await getMessage(body.threadId);
    if (!message) return Response.json({ error: "Thread not found" }, { status: 404 });
    recordContext = buildRecordContext(message);
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    recordContext,
    history: body.history,
  });

  return Response.json(result);
}
