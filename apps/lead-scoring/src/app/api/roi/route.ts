import { listLeads } from "@/lib/store";
import { roiMetrics } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  const leads = await listLeads();
  return Response.json(roiMetrics(leads));
}
