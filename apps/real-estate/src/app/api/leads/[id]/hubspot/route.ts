import { aiCtx, deskWriteDenied } from "@/lib/ai-desk";
import { upsertHubspotContact } from "@/lib/hubspot";
import { getLead, logActivity, putLead } from "@/lib/store";

export const runtime = "nodejs";

/** Creates or updates this buyer as a HubSpot contact after the agent confirmed it. Body: { confirm: true }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== true) return Response.json({ error: "Pushing to HubSpot needs your explicit confirmation." }, { status: 400 });
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Buyer not found." }, { status: 404 });
  const r = await upsertHubspotContact(lead);
  const actor = aiCtx(req).actor;
  if (!r.ok) {
    if (!r.notConfigured) await logActivity({ actor, action: "push_hubspot", kind: "run", via: "button", labels: [lead.name], done: 0, failed: 1 });
    return Response.json({ pushed: false, error: r.error, notConfigured: !!r.notConfigured }, { status: r.notConfigured ? 409 : 502 });
  }
  const { buyer: _score, ...plain } = lead;
  void _score;
  await putLead({ ...plain, crm: { provider: "hubspot", contactId: r.contactId, pushedAt: new Date().toISOString() } });
  await logActivity({ actor, action: "push_hubspot", kind: "run", via: "button", labels: [lead.name], done: 1, failed: 0 });
  return Response.json({ pushed: true, contactId: r.contactId, created: r.created });
}
