import { getLead } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOrgScope(async (orgId) => {
    const lead = await getLead(id, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    return Response.json({ lead });
  });
}
