import { listLeads } from "@/lib/store";
import { resurrectLeads } from "@helix/core";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET() {
  return withOrgScope(async (orgId) => {
    const leads = await listLeads(orgId);
    const hits = resurrectLeads(leads).map((h) => ({
      id: h.lead.id,
      name: h.lead.name,
      email: h.lead.email,
      score: h.lead.score,
      reason: h.reason,
      scoreBoost: h.scoreBoost,
    }));
    return Response.json({ hits });
  });
}
