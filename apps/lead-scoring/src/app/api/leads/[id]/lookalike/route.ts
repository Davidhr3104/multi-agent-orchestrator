import { getLead, listLeads } from "@/lib/store";
import { lookalikeLeads } from "@helix/core";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrgScope(async (orgId) => {
    const seed = await getLead(id, orgId);
    if (!seed) return Response.json({ error: "Lead not found" }, { status: 404 });
    const likes = lookalikeLeads(seed, await listLeads(orgId)).map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      score: l.score,
      tier: l.tier,
      source: l.source,
      company: l.company,
    }));
    return Response.json({ likes });
  });
}
