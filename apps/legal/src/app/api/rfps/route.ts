import { listRfps, getClientProfile, conflictSummaries, pricingSummaries } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const rfps = await listRfps();
  const conflicts = await conflictSummaries();
  const pricing = await pricingSummaries();
  return Response.json({ rfps, clientProfile: getClientProfile(), conflicts, pricing });
}
