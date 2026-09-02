import { completeWithClaude, draftOutreachHeuristic, isClaudeConfigured } from "@helix/core";
import { getLead, patchLead } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { id?: string } = {};
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

  const heuristic = draftOutreachHeuristic(lead);
  let subject = heuristic.subject;
  let emailBody = heuristic.body;
  if (isClaudeConfigured()) {
    const text = await completeWithClaude(
      `Write a professional English sales email in 3-4 short paragraphs. Return ONLY JSON {"subject","body"}.
Address ${lead.name} at ${lead.company || lead.enrichment?.company || "their company"}.
Industry: ${lead.enrichment?.industry || lead.enrichedIndustry || "unknown"}.
Budget: ${lead.budget || "not stated"}. Timeline: ${lead.timeline || "not stated"}.
Mention one concrete detail from their message (do not invent facts): ${lead.message.slice(0, 500)}
Tone: concise, peer-to-peer, no hype.`,
      900
    );
    if (text) {
      try {
        const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
          subject?: string;
          body?: string;
        };
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) emailBody = parsed.body;
      } catch {
        /* heuristic */
      }
    }
  }
  const draft = `Subject: ${subject}\n\n${emailBody}`;
  const saved = await patchLead(id, { outreachDraft: draft });
  return Response.json({ subject, body: emailBody, draft, lead: saved ?? lead });
}
