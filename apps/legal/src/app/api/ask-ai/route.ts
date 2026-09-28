import { askAi, type AskAiMessage } from "@helix/core";
import type { ScoredField, StoredRfp } from "@helix/core";
import { getRfp } from "@/lib/store";

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

export async function POST(req: Request) {
  const body = (await req.json()) as { rfpId?: string; history?: AskAiMessage[] };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  let recordContext: string | undefined;
  if (body.rfpId) {
    const rfp: StoredRfp | null = await getRfp(body.rfpId);
    if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
    recordContext = buildRecordContext(rfp);
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    recordContext,
    history: body.history,
  });

  return Response.json(result);
}
