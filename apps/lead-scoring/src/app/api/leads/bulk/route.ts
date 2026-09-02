import { deleteLeads, getLead, patchLead, patchLeads } from "@/lib/store";
import { sendLeadToGhl } from "@/lib/ghl";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = body as { ids?: unknown; action?: unknown };
  const ids = Array.isArray(row.ids) ? row.ids.map(String).filter(Boolean) : [];
  const action = String(row.action ?? "");
  if (ids.length === 0) return Response.json({ error: "ids required" }, { status: 400 });

  if (action === "delete") {
    const removed = await deleteLeads(ids);
    return Response.json({ ok: true, removed });
  }
  if (action === "review") {
    const leads = await patchLeads(ids, { needsReview: false });
    return Response.json({ ok: true, leads });
  }
  if (action === "ghl") {
    const leads = [];
    for (const id of ids) {
      const current = await getLead(id);
      if (!current) continue;
      const result = await sendLeadToGhl(current);
      if (result.mocked) {
        const lead = await patchLead(id, { crmStatus: "mocked", pipelineStage: "contacted" });
        if (lead) leads.push(lead);
      } else if (result.ok && result.contactId) {
        const lead = await patchLead(id, {
          crmStatus: "sent",
          ghlContactId: result.contactId,
          pipelineStage: "contacted",
        });
        if (lead) leads.push(lead);
      }
    }
    return Response.json({ ok: true, leads });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
