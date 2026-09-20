import { listLeads } from "@/lib/store";
import { isGhlConfigured } from "@/lib/ghl";
import { withOrgScope } from "@/lib/org-auth";
import { sourceAttribution } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return withOrgScope(async (orgId) => {
    const leads = await listLeads(orgId);
    return Response.json({
      leads,
      ghlConfigured: isGhlConfigured(),
      attribution: sourceAttribution(leads),
    });
  });
}
