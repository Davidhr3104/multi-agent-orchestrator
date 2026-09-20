import { getLead, patchLead } from "@/lib/store";
import { sendLeadToGhl } from "@/lib/ghl";
import { bumpUsage } from "@/lib/usage";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const current = await getLead(id);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

  const result = await sendLeadToGhl(current);
  if (result.mocked) {
    return Response.json(
      {
        error: "GHL_API_KEY and GHL_LOCATION_ID required. Paste them in Settings. CRM was not sent.",
        lead: current,
      },
      { status: 409 }
    );
  }
  bumpUsage("ghl");
  if (result.ok && result.contactId) {
    const lead = await patchLead(id, {
      crmStatus: "sent",
      ghlContactId: result.contactId,
      pipelineStage: "contacted",
      reviewedBy: operatorActor(req),
      reviewedAt: new Date().toISOString(),
    });
    return Response.json({ lead, ghlContactId: result.contactId });
  }
  return Response.json({ error: result.error || "GHL send failed", lead: current }, { status: 502 });
}
