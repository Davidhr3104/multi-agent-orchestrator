import { askAi, askAiWithProposal, type AskAiMessage } from "@helix/core";
import { getLead, listLeads } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";
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

const PROPOSAL_INSTRUCTION = `If, and only if, the operator explicitly asks you to clean up, remove, or archive stale/cold leads, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"archive_leads","summary":"<one sentence describing what you found and will archive>","targets":[{"id":"<lead id>","label":"<lead name>"}]}
\`\`\`
Only include leads from the "Cold candidates" list below in targets — never invent a lead id that wasn't provided. For any other question, answer normally in plain text; do not emit a json block.`;

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

function buildSnapshotContext(leads: StoredLead[]): string {
  if (leads.length === 0) return "There are currently no leads in the system.";

  const byTier = { hot: 0, warm: 0, cold: 0, disqualified: 0 } as Record<string, number>;
  for (const l of leads) byTier[l.tier] = (byTier[l.tier] ?? 0) + 1;

  const topByScore = [...leads]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((l) => `- ${l.name} (${l.id}): score ${l.score}, tier ${l.tier}, created ${l.createdAt}`)
    .join("\n");

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const coldCandidates = leads.filter((l) => {
    const ageMs = now - Date.parse(l.createdAt);
    return l.tier === "cold" && ageMs > THIRTY_DAYS_MS;
  });

  const coldLines = coldCandidates.length
    ? coldCandidates.map((l) => `- ${l.name} (${l.id}): created ${l.createdAt}`).join("\n")
    : "None.";

  return [
    `Total leads: ${leads.length}`,
    `By tier: ${Object.entries(byTier).map(([t, n]) => `${t}=${n}`).join(", ")}`,
    `Top leads by score:`,
    topByScore,
    `Cold candidates (cold tier, idle 30+ days) — these are the ONLY leads you may ever propose archiving:`,
    coldLines,
  ].join("\n");
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

    if (body.mode === "drawer") {
      const result = await askAiWithProposal({
        systemPrompt: SYSTEM_PROMPT,
        recordContext,
        history: body.history,
        proposalInstruction: PROPOSAL_INSTRUCTION,
      });
      return Response.json(result);
    }

    const result = await askAi({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
    });

    return Response.json(result);
  });
}
