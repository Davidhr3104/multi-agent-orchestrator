import { listLeads } from "@/lib/store";
import { roiMetrics } from "@helix/core";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET() {
  return withOrgScope(async (orgId) => {
    const leads = await listLeads(orgId);
    return Response.json(roiMetrics(leads));
  });
}
