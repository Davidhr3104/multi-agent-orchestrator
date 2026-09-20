import { deleteLeads, getLead, patchLead, patchLeads } from "@/lib/store";
import { sendLeadToGhl } from "@/lib/ghl";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { supabaseDeleteLeads } from "@/lib/supabase-leads";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
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
  const actor = operatorActor(req);
  const at = new Date().toISOString();

  if (action === "delete") {
    const removed = await deleteLeads(ids);
    await supabaseDeleteLeads(ids);
    return Response.json({ ok: true, removed });
  }
  if (action === "review") {
    const leads = await patchLeads(ids, { needsReview: false, reviewedBy: actor, reviewedAt: at });
    return Response.json({ ok: true, leads });
  }
  if (action === "archive") {
    const leads = await patchLeads(ids, {
      needsReview: false,
      pipelineStage: "lost",
      reviewedBy: actor,
      reviewedAt: at,
    });
    return Response.json({ ok: true, leads });
  }
  if (action === "ghl") {
    const leads = [];
    const errors: { id: string; error: string }[] = [];
    for (const id of ids) {
      const current = await getLead(id);
      if (!current) continue;
      const result = await sendLeadToGhl(current);
      if (result.mocked) {
        errors.push({
          id,
          error: "GHL_API_KEY and GHL_LOCATION_ID required. Paste them in Settings.",
        });
        continue;
      }
      if (result.ok && result.contactId) {
        const lead = await patchLead(id, {
          crmStatus: "sent",
          ghlContactId: result.contactId,
          pipelineStage: "contacted",
          reviewedBy: actor,
          reviewedAt: at,
        });
        if (lead) leads.push(lead);
      } else {
        errors.push({ id, error: result.error || "GHL send failed" });
      }
    }
    if (leads.length === 0 && errors.length > 0) {
      return Response.json({ ok: false, leads, errors }, { status: errors[0].error.includes("required") ? 409 : 502 });
    }
    return Response.json({ ok: true, leads, errors });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
