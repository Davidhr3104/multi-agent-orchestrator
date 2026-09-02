import { patchLead } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await patchLead(id, { crmStatus: "mocked" });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead, note: "CRM send mocked. GHL connector is out of this MVP." });
}
