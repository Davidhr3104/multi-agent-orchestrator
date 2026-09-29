import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import { aiCtx, applyRiskPolicy, loadDeskState, respondWithDeskCookie } from "@/lib/ai-desk";
import { buildDemoReply } from "@/lib/demo-assistant";
import { currentDeskMode, getMessage, listAllThreads, listMessages } from "@/lib/store";
import type { EmailThread } from "@/lib/types";

const PROPOSAL_INSTRUCTION = `Only when the operator explicitly asks you to act, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence>","targets":[{"id":"<thread id>","label":"<sender — subject>"}]}
\`\`\`
Supported actions — targets must be thread ids copied from the desk snapshot below, never invented:
- "draft_reply": write a draft reply (nothing is sent).
- "snooze_threads": snooze a thread.
- "archive_threads": archive a thread.
- "route_threads": route a thread to its owner.
- "send_reply": send the drafted reply (emails a real person).
For any other question, answer normally in plain text; do not emit a json block.`;

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

async function buildSnapshotContext(): Promise<string> {
  const messages = await listMessages();
  if (messages.length === 0) return "The inbox is currently empty.";
  const open = messages.filter((m) => m.status !== "archived" && m.status !== "sent");
  const urgent = [...open]
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 8)
    .map(
      (m) =>
        `- [id: ${m.id}] "${m.subject}" from ${m.fromName}: urgency ${m.urgencyScore}, category ${m.category}, status ${m.status}, needs review ${m.needsReview}`
    )
    .join("\n");
  return [
    `Desk snapshot — threads: ${messages.length}, open: ${open.length}, needing review: ${open.filter((m) => m.needsReview).length}`,
    `Most urgent open threads:`,
    urgent || "None.",
  ].join("\n");
}

export async function POST(req: Request) {
  loadDeskState(req);
  const body = (await req.json()) as { threadId?: string; history?: AskAiMessage[]; mode?: "card" | "drawer" };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  let recordContext: string | undefined;
  if (body.threadId) {
    const message = await getMessage(body.threadId);
    if (!message) return Response.json({ error: "Thread not found" }, { status: 404 });
    recordContext = buildRecordContext(message);
  } else if (body.mode === "drawer") {
    recordContext = await buildSnapshotContext();
  }

  if (body.mode === "drawer") {
    const ctx = aiCtx(req);
    // Demo desk without a Claude key: answer from the real threads with the deterministic assistant.
    if (!isClaudeConfigured() && currentDeskMode() === "demo") {
      const last = body.history[body.history.length - 1];
      if (last.attachments?.length) {
        return Response.json({
          answer: "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll analyze screenshots alongside your inbox.",
          engine: "fallback",
          demo: true,
        });
      }
      const reply = buildDemoReply(last.content, await listAllThreads());
      return respondWithDeskCookie(req, ctx, { ...(await applyRiskPolicy(req, ctx, reply)), engine: "fallback", demo: true });
    }
    const result = await askAiWithProposal({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
      proposalInstruction: PROPOSAL_INSTRUCTION,
    });
    // Claude only emits a proposal when the operator explicitly asked to act, so treat it as a command.
    return respondWithDeskCookie(req, ctx, await applyRiskPolicy(req, ctx, { ...result, command: Boolean(result.proposal) }));
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    recordContext,
    history: body.history,
  });

  return Response.json(result);
}
