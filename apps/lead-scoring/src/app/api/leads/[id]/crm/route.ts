import { getLead, patchLead } from "@/lib/store";
import { sendLeadToGhl } from "@/lib/ghl";
import { bumpUsage } from "@/lib/usage";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const current = await getLead(id);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

  const result = await sendLeadToGhl(current);
  bumpUsage("ghl");
  if (result.mocked) {
    const lead = await patchLead(id, { crmStatus: "mocked", pipelineStage: "contacted" });
    return Response.json({
      lead,
      note: "GHL_API_KEY or GHL_LOCATION_ID missing; stored crm_status=mocked.",
    });
  }
  if (result.ok && result.contactId) {
    const lead = await patchLead(id, {
      crmStatus: "sent",
      ghlContactId: result.contactId,
      pipelineStage: "contacted",
    });
    return Response.json({ lead, ghlContactId: result.contactId });
  }
  return Response.json({ error: result.error || "GHL send failed", lead: current }, { status: 502 });
}
