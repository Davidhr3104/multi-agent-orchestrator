import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { applyRiskPolicy } from "@/lib/ai-desk";
import { buildDemoReply } from "@/lib/demo-assistant";
import { currentDeskMode, getSnapshot } from "@/lib/store";

const PROPOSAL_INSTRUCTION = `Only when the operator explicitly asks you to act, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence>","targets":[{"id":"<campaign id>","label":"<campaign name>"}]}
\`\`\`
Supported actions — targets must be campaign ids copied from the desk snapshot below, never invented:
- "keep_campaign": keep a campaign running and clear its review flag.
- "pause_campaign": pause a campaign.
- "scale_campaign": scale a campaign.
For any other question, answer normally in plain text; do not emit a json block.`;

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Marketing, a campaign spend-quality tool.

How the app works:
- The app joins ad spend data (Meta, Google) with lead-quality classification, so operators can see spend that produced low-quality/spam traffic ("spend on spam"), not just cost-per-lead.
- Each campaign is scored for waste based on the ratio of spend to qualified leads it actually produced.
- Operators review flagged campaigns in a human-in-the-loop queue and can pause or scale a campaign; every write-back to the ad platform requires human sign-off, never fully automated.
- The dashboard groups spend and leads by campaign and by time window (e.g. last 7 days).

Answer using the description above. When a desk snapshot is provided below, use its numbers and do not invent any that are not in it. If no snapshot is provided and the operator asks about a specific campaign's numbers, tell them to open that campaign's row for details.`;

async function buildSnapshotContext(): Promise<string> {
  const snap = await getSnapshot("7d");
  const w = snap.waste;
  const campaigns = [...snap.campaigns]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8)
    .map(
      (c) =>
        `- ${c.name} [id: ${c.campaignId}] (${c.platform}): spend ${c.spend}, suggested action ${c.action}, needs review ${c.needsReview}, status ${c.status}`
    )
    .join("\n");
  return [
    `Desk snapshot (last 7 days) — total spend: ${w.totalSpend}, spend on spam leads: ${w.spendOnSpam} (${w.wastePct}% waste), leads: ${w.nLeads} (hot ${w.nHot}, spam ${w.nSpam})`,
    `Worst campaign: ${w.worstCampaignName ?? "n/a"}`,
    `Campaigns by spend:`,
    campaigns || "None.",
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { history?: AskAiMessage[]; mode?: "card" | "drawer" };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  const recordContext = body.mode === "drawer" ? await buildSnapshotContext() : undefined;
  const claudeDenied = isClaudeConfigured() ? requireOperator(req) : null;
  const demo = currentDeskMode() === "demo";
  if (claudeDenied && !demo) return claudeDenied;
  if (claudeDenied && body.mode !== "drawer") {
    const last = body.history[body.history.length - 1];
    return Response.json({ answer: buildDemoReply(last.content, await getSnapshot("7d")).answer, engine: "fallback", demo: true });
  }

  if (body.mode === "drawer") {
    // Demo desk without Claude (no key, or no operator unlock): answer from the real numbers with the deterministic assistant.
    if ((!isClaudeConfigured() || claudeDenied) && demo) {
      const last = body.history[body.history.length - 1];
      if (last.attachments?.length) {
        return Response.json({
          answer: "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll analyze screenshots alongside your campaigns.",
          engine: "fallback",
          demo: true,
        });
      }
      const reply = buildDemoReply(last.content, await getSnapshot("7d"));
      return Response.json({ ...(await applyRiskPolicy(req, reply)), engine: "fallback", demo: true });
    }
    const result = await askAiWithProposal({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
      proposalInstruction: PROPOSAL_INSTRUCTION,
    });
    // Claude only emits a proposal when the operator explicitly asked to act, so treat it as a command.
    return Response.json(await applyRiskPolicy(req, { ...result, command: Boolean(result.proposal) }));
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    recordContext,
    history: body.history,
  });

  return Response.json(result);
}
