import { askAi, type AskAiMessage } from "@helix/core";
import { getLead } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";
import type { ScoredField } from "@helix/core";

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

export async function POST(req: Request) {
  return withOrgScope(async (orgId): Promise<Response> => {
    const body = (await req.json()) as { leadId?: string; history?: AskAiMessage[] };

    if (!Array.isArray(body.history) || body.history.length === 0) {
      return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
    }

    let recordContext: string | undefined;
    if (body.leadId) {
      const lead = await getLead(body.leadId, orgId);
      if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
      recordContext = buildRecordContext(lead);
    }

    const result = await askAi({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
    });

    return Response.json(result);
  });
}
