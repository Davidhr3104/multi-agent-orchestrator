import { patchRfp, recordAudit } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await patchRfp(id, { needsReview: false });
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  await recordAudit("ops", "review", `Marked reviewed: ${rfp.title}`);
  return Response.json({ rfp });
}
