import { cacheHeuristicConflict, checkAndStoreConflict, getCachedConflict, getRfp } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  const report = getCachedConflict(id) ?? (await cacheHeuristicConflict(rfp));
  return Response.json({ report });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  const report = await checkAndStoreConflict(rfp);
  return Response.json({ report });
}
