import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { aiActor, runAiAction } from "@/lib/ai-actions";
import { assessRisk } from "@/lib/ai-risk";
import { buildDemoReply, type DemoProposal } from "@/lib/demo-assistant";
import { deskModeFor, getLead, listLeads } from "@/lib/store";
import { requireOperatorOrGuest, withOrgScope } from "@/lib/org-auth";
import type { ScoredField, StoredLead } from "@helix/core";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Leads, a B2B lead intelligence tool.

How the app works:
- Every inbound lead is scored 0-100 and placed in a tier (hot, warm, cold, or disqualified) based on fit signals like budget, timeline, and industry match.
- "Confidence" is how sure the scoring engine is about its own classification, separate from the score itself.
- "Reasoning" is the scoring engine's explanation for why it assigned that score and tier.
- Each scored field (e.g. budget, timeline, industry fit) carries its own evidence — the specific input text that justified its value.
- Operators review leads in a human-in-the-loop queue: they can Approve & Push (send to the CRM), Archive, or manually adjust a lead before it moves forward. Approve & Push shows a 5-second undo window before the CRM sync is final.
- "Pipeline stage" tracks a lead's position after being pushed to the CRM (e.g. new, contacted, qualified).

When a specific lead's data is provided below, answer using that data — do not invent facts not present in it. When no lead data is provided, answer only using the description above.`;

const PROPOSAL_INSTRUCTION = `Only when the operator explicitly asks you to act on leads, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence describing what you found and will do>","targets":[{"id":"<lead id>","label":"<lead name>"}]}
\`\`\`
Supported actions and where their targets must come from — never invent a lead id:
- "archive_leads": the operator asks to clean up, remove or archive stale leads. Targets come ONLY from the "Cold candidates" list.
- "approve_leads": the operator asks to approve or clear the human-review queue. Targets come ONLY from the "Review queue" list.
For any other question, answer normally in plain text; do not emit a json block.`;

function buildRecordContext(lead: {
  classification: string;
  score: number;
  tier: string;
  confidence: number;
  reasoning: string;
  fields: ScoredField[];
}): string {
  const fieldLines = lead.fields
    .map((f) => `- ${f.label}: ${f.value} (evidence: ${f.evidence})`)
    .join("\n");
  return [
    `Lead classification: ${lead.classification}`,
    `Score: ${lead.score}`,
    `Tier: ${lead.tier}`,
    `Confidence: ${lead.confidence}`,
    `Reasoning: ${lead.reasoning}`,
    `Scored fields:`,
    fieldLines,
  ].join("\n");
}

function buildSnapshotContext(allLeads: StoredLead[]): string {
  // Archived ("lost") and spam leads are not part of the live pipeline the operator is asking about.
  const leads = allLeads.filter((l) => l.pipelineStage !== "lost" && l.classification !== "spam");
  if (leads.length === 0) return "There are currently no active leads in the system.";

  const byTier = { hot: 0, warm: 0, cold: 0, disqualified: 0 } as Record<string, number>;
  for (const l of leads) byTier[l.tier] = (byTier[l.tier] ?? 0) + 1;

  const topByScore = [...leads]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((l) => `- ${l.name} (${l.id}): score ${l.score}, tier ${l.tier}, created ${l.createdAt}`)
    .join("\n");

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const coldCandidates = leads.filter((l) => l.tier === "cold" && now - Date.parse(l.createdAt) > THIRTY_DAYS_MS);
  const reviewQueue = leads.filter((l) => l.needsReview);
  const list = (rows: StoredLead[]) =>
    rows.length ? rows.map((l) => `- ${l.name} (${l.id}): score ${l.score}, created ${l.createdAt}`).join("\n") : "None.";

  return [
    `Total active leads: ${leads.length}`,
    `By tier: ${Object.entries(byTier).map(([t, n]) => `${t}=${n}`).join(", ")}`,
    `Top leads by score:`,
    topByScore,
    `Cold candidates (cold tier, idle 30+ days) — the ONLY leads you may propose archiving:`,
    list(coldCandidates),
    `Review queue (flagged for human review) — the ONLY leads you may propose approving:`,
    list(reviewQueue),
  ].join("\n");
}

type ProposalReply = { answer: string; proposal?: DemoProposal; command?: boolean } & Record<string, unknown>;

/**
 * Risk gate for requests where the operator explicitly asked for a change. Safe, reversible
 * actions run right away and come back with an undo snapshot; anything risky stays a proposal
 * and says why it needs a human click. Questions never reach this path with command=true.
 */
async function applyRiskPolicy(req: Request, orgId: string | undefined, reply: ProposalReply): Promise<Record<string, unknown>> {
  const { command, proposal, ...rest } = reply;
  if (!command || !proposal) return { ...rest, proposal };

  const leads = await listLeads(orgId);
  const targets = proposal.targets.flatMap((t) => leads.find((l) => l.id === t.id) ?? []);
  const risk = assessRisk(proposal.action, targets);
  if (targets.length !== proposal.targets.length) risk.reasons.push("A target lead no longer exists");

  const canAutoRun = risk.level === "auto" && targets.length === proposal.targets.length && !(await requireOperatorOrGuest(req));
  if (!canAutoRun) {
    const why = risk.reasons.length ? `

I'm asking first because: ${risk.reasons.join("; ").toLowerCase()}.` : "";
    return { ...rest, answer: `${reply.answer}${why}`, proposal, reasons: risk.reasons };
  }

  const { done, failed, undo } = await runAiAction(
    { action: proposal.action, targetIds: proposal.targets.map((t) => t.id), stage: proposal.stage, note: proposal.note },
    aiActor(operatorActor(req)),
    orgId
  );
  return { ...rest, executed: { action: proposal.action, summary: proposal.summary, targets: proposal.targets, done, failed, undo } };
}

export async function POST(req: Request) {
  return withOrgScope(async (orgId): Promise<Response> => {
    const body = (await req.json()) as {
      leadId?: string;
      history?: AskAiMessage[];
      mode?: "card" | "drawer";
    };

    if (!Array.isArray(body.history) || body.history.length === 0) {
      return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
    }

    let recordContext: string | undefined;
    if (body.leadId) {
      const lead = await getLead(body.leadId, orgId);
      if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
      recordContext = buildRecordContext(lead);
    } else if (body.mode === "drawer") {
      const leads = await listLeads(orgId);
      recordContext = buildSnapshotContext(leads);
    }

    // Demo desk without a Claude key: answer from the real leads with the deterministic
    // assistant instead of dumping raw context. Clearly labeled demo so the UI never
    // presents it as a live model.
    const claudeLocked = isClaudeConfigured() && Boolean(requireOperator(req));
    if (body.mode === "drawer" && (claudeLocked || (!isClaudeConfigured() && (await deskModeFor(orgId)) === "demo"))) {
      const last = body.history[body.history.length - 1];
      if (last.attachments?.length) {
        return Response.json({
          answer: claudeLocked
            ? "I can't read attachments without operator unlock. Unlock at /operator and I'll analyze images with Claude."
            : "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll analyze images alongside your pipeline.",
          engine: "fallback",
          demo: true,
        });
      }
      const reply = buildDemoReply(last.content, await listLeads(orgId), Date.now());
      return Response.json({ ...(await applyRiskPolicy(req, orgId, reply)), engine: "fallback", demo: true });
    }

    if (body.mode === "drawer") {
      const result = await askAiWithProposal({
        systemPrompt: SYSTEM_PROMPT,
        recordContext,
        history: body.history,
        proposalInstruction: PROPOSAL_INSTRUCTION,
      });
      return Response.json(result);
    }

    if (claudeLocked) {
      return Response.json({
        answer: recordContext ?? "Claude answers need operator unlock on this deployment. Visit /operator to unlock.",
        engine: "fallback",
        operatorRequired: true,
      });
    }

    const result = await askAi({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
    });

    return Response.json(result);
  });
}
