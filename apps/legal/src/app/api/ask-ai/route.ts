import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import type { ScoredField, StoredRfp } from "@helix/core";
import { applyRiskPolicy } from "@/lib/ai-desk";
import { buildDemoReply } from "@/lib/demo-assistant";
import { currentDeskMode, getRfp, listRfps } from "@/lib/store";

const PROPOSAL_INSTRUCTION = `Only when the operator explicitly asks you to act, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence>","targets":[{"id":"<rfp id>","label":"<title>"}],"params":{}}
\`\`\`
Supported actions — targets must be ids copied from the desk snapshot below, never invented:
- "flag_review": send an RFP to partner review.
- "add_note": log a note; params {"note":"<text>"}.
- "run_conflict_check": run the conflict-of-interest check.
- "run_pricing": prepare a fee quote.
- "record_decision": record the partner's decision; params {"verdict":"GO"|"CONDITIONAL"|"NO-GO"}.
For any other question, answer normally in plain text; do not emit a json block.`;

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Legal, an RFP intelligence tool for law firms.

How the app works:
- Every incoming RFP is matched against the firm's profile and given a match score, a tier, and a Go/No-Go recommendation method.
- "Confidence" is how sure the scoring engine is about its own match assessment.
- "Reasoning" is the engine's explanation for why it scored the RFP the way it did.
- Each scored field carries its own evidence — the specific input text that justified its value.
- "Unverified count" tracks facts the engine could not confirm against the firm's own documents, rather than inventing a citation.
- Operators review flagged RFPs in a human-in-the-loop queue before a partner decision (GO / CONDITIONAL / NO-GO) is finalized, with conflict-of-interest checks run alongside.

When a specific RFP's data is provided below, answer using that data — do not invent facts not present in it. When no RFP data is provided, answer only using the description above.`;

function buildRecordContext(rfp: {
  title: string;
  issuer: string;
  matchScore: number;
  tier: string;
  confidence: number;
  reasoning: string;
  unverifiedCount: number;
  fields: ScoredField[];
}): string {
  const fieldLines = rfp.fields
    .map((f) => `- ${f.label}: ${f.value} (evidence: ${f.evidence})`)
    .join("\n");
  return [
    `Title: ${rfp.title}`,
    `Issuer: ${rfp.issuer}`,
    `Match score: ${rfp.matchScore}`,
    `Tier: ${rfp.tier}`,
    `Confidence: ${rfp.confidence}`,
    `Unverified facts: ${rfp.unverifiedCount}`,
    `Reasoning: ${rfp.reasoning}`,
    `Scored fields:`,
    fieldLines,
  ].join("\n");
}

async function buildSnapshotContext(): Promise<string> {
  const rfps = await listRfps();
  if (rfps.length === 0) return "There are currently no RFPs in the system.";
  const top = [...rfps]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10)
    .map(
      (r) =>
        `- ${r.title} [id: ${r.id}] (${r.issuer}): match ${r.matchScore}, tier ${r.tier}, deadline ${r.deadline}, unverified facts ${r.unverifiedCount}, needs review ${r.needsReview}, partner decision ${r.partnerDecision?.verdict ?? "none"}`
    )
    .join("\n");
  return [
    `Desk snapshot — total RFPs: ${rfps.length}, flagged for review: ${rfps.filter((r) => r.needsReview).length}`,
    `Top RFPs by match score:`,
    top,
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { rfpId?: string; history?: AskAiMessage[]; mode?: "card" | "drawer" };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  let recordContext: string | undefined;
  if (body.rfpId) {
    const rfp: StoredRfp | null = await getRfp(body.rfpId);
    if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
    recordContext = buildRecordContext(rfp);
  } else if (body.mode === "drawer") {
    recordContext = await buildSnapshotContext();
  }

  if (body.mode === "drawer") {
    // Demo desk without a Claude key: answer from the real RFPs with the deterministic assistant.
    if (!isClaudeConfigured() && currentDeskMode() === "demo") {
      const last = body.history[body.history.length - 1];
      if (last.attachments?.length) {
        return Response.json({
          answer: "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll analyze documents alongside your RFPs.",
          engine: "fallback",
          demo: true,
        });
      }
      const reply = buildDemoReply(last.content, await listRfps(), Date.now());
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
