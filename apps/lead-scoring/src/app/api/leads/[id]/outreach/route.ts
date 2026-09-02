import { getLead, patchLead } from "@/lib/store";
import { completeWithClaude, draftOutreachHeuristic, isClaudeConfigured } from "@helix/core";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  const heuristic = draftOutreachHeuristic(lead);
  let subject = heuristic.subject;
  let body = heuristic.body;
  if (isClaudeConfigured()) {
    const text = await completeWithClaude(
      `Write a short English sales email for this contact. Return JSON {"subject","body"}. Use only facts given. Lead JSON: ${JSON.stringify({
        name: lead.name,
        company: lead.company || lead.enrichment?.company,
        industry: lead.enrichment?.industry,
        source: lead.source,
        score: lead.score,
        message: lead.message.slice(0, 400),
      })}`
    );
    if (text) {
      try {
        const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
          subject?: string;
          body?: string;
        };
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) body = parsed.body;
      } catch {
        /* keep heuristic */
      }
    }
  }
  const draft = `Subject: ${subject}\n\n${body}`;
  const saved = await patchLead(id, { outreachDraft: draft });
  return Response.json({ subject, body, draft, lead: saved ?? lead });
}
