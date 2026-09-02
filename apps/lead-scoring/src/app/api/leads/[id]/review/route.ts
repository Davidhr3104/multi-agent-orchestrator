import { patchLead } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await patchLead(id, { needsReview: false });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead });
}
