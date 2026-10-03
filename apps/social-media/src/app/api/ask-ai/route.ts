import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import { applyRiskPolicy } from "@/lib/ai-desk";
import { buildDemoReply } from "@/lib/demo-assistant";
import { postLabel } from "@/lib/format";
import { currentDeskMode, getBrand, listPosts } from "@/lib/store";

export const runtime = "nodejs";

const PROPOSAL_INSTRUCTION = `Only when the operator explicitly asks you to act, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence>","targets":[{"id":"<post id>","label":"<post label>"}],"params":{}}
\`\`\`
Supported actions — targets must be post ids copied from the desk snapshot below, never invented:
- "approve_post": record a person's approval of a post (always confirmed by a person; publishes nothing).
- "request_changes": send a post back. params: {"note":"<what to change>"} (required).
- "submit_for_review": move a draft into the approval queue.
- "reschedule_post": move a post. params: {"when":"<ISO 8601 date-time>"} (required).
- "add_note": internal note on a post. params: {"note":"<text>"} (required).
For any other question, answer normally in plain text; do not emit a json block.`;

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Social Media, a content-calendar desk for a brand's social team.

How the app works:
- Posts are planned per channel (Instagram, LinkedIn, X, TikTok, Facebook) on a calendar, with a status: draft, needs review, changes requested, approved.
- Each post gets a readiness score 0-100 from length for its channel, hashtag count, call to action, brand voice (avoid list) and visual brief. It checks form, not taste.
- A person approves every post. Approval records a sign-off. A post goes out only when a person presses Publish on that approved post and the operator enabled live publishing; you can never publish.

Rules: answer only from the desk snapshot below and never invent posts, dates, scores or engagement numbers (planned posts have none; real account results live on the Analytics page). When you mention a post, write it as a markdown link: [label](/posts/<post id>).`;

async function snapshot(): Promise<string> {
  const [posts, brand] = await Promise.all([listPosts(), getBrand()]);
  if (posts.length === 0) return "The desk has no posts.";
  return [
    `Brand: ${brand.name} ${brand.handle}. Voice: ${brand.voice.join(", ") || "not set"}. Avoid: ${brand.avoid.join(", ") || "nothing listed"}.`,
    `Today: ${new Date().toISOString()}`,
    `Posts (${posts.length}):`,
    ...posts.map(
      (p) =>
        `- ${postLabel(p)} [id: ${p.id}] ${p.scheduledFor}, status ${p.status}, readiness ${p.readiness.score} (${p.readiness.ready ? "ready" : "not ready"}: ${p.readiness.summary}) caption: "${p.caption}" hashtags: ${p.hashtags.map((t) => `#${t}`).join(" ") || "none"}`
    ),
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { history?: AskAiMessage[]; mode?: "card" | "drawer" };
  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  // Demo desk without a Claude key: answer from the real posts with the deterministic assistant.
  if (!isClaudeConfigured() && currentDeskMode() === "demo") {
    const last = body.history[body.history.length - 1];
    if (last.attachments?.length) {
      return Response.json({
        answer: "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll review images alongside your posts.",
        engine: "fallback",
        demo: true,
      });
    }
    const [posts, brand] = await Promise.all([listPosts(), getBrand()]);
    const reply = buildDemoReply(last.content, posts, brand, Date.now());
    return Response.json({ ...(await applyRiskPolicy(req, reply)), engine: "fallback", demo: true });
  }

  const recordContext = await snapshot();
  if (body.mode === "drawer") {
    const result = await askAiWithProposal({ systemPrompt: SYSTEM_PROMPT, recordContext, history: body.history, proposalInstruction: PROPOSAL_INSTRUCTION });
    return Response.json(await applyRiskPolicy(req, { ...result, command: Boolean(result.proposal) }));
  }
  return Response.json(await askAi({ systemPrompt: SYSTEM_PROMPT, recordContext, history: body.history }));
}
