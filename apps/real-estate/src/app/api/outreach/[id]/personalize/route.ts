import { aiCtx, deskWriteDenied } from "@/lib/ai-desk";
import { writeMatchAlert } from "@/lib/ai-copy";
import { isTone } from "@/lib/outreach";
import { getDraft, getLead, getProperty, logActivity, putDraft } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Claude rewrites a pending new-listing alert and explains the match. The fit score and the "why" list stay exactly
 * as the desk computed them; the draft stays pending until the agent approves it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { tone?: unknown };
  const d = await getDraft(id);
  if (!d) return Response.json({ error: "Draft not found." }, { status: 404 });
  if (d.kind !== "new_match") return Response.json({ error: "Only new-listing alerts can be personalized." }, { status: 400 });
  if (d.status !== "pending") return Response.json({ error: `This draft is already ${d.status}.` }, { status: 409 });
  const [lead, p] = await Promise.all([getLead(d.leadId), getProperty(d.propertyIds[0] ?? "")]);
  if (!lead || !p) return Response.json({ error: "The buyer or the listing is no longer on the desk." }, { status: 404 });

  const r = await writeMatchAlert(lead, p, isTone(body.tone) ? body.tone : "friendly");
  if (r.engine !== "claude") return Response.json({ updated: false, note: r.note, cost: r.cost ?? null }, { status: 200 });
  await putDraft({ ...d, subject: r.subject, body: r.body, explanation: r.explanation, writer: "claude" });
  await logActivity({ actor: aiCtx(req).actor, action: "personalize_draft", kind: "run", via: "button", labels: [`${lead.name}: ${p.title}`], done: 1, failed: 0 });
  return Response.json({ updated: true, cost: r.cost ?? null });
}
