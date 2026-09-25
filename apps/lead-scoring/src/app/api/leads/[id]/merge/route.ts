import { getLead, patchLead, deleteLeads } from "@/lib/store";
import { attachIntelligence } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { intoId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const intoId = body.intoId;
  if (!intoId) return Response.json({ error: "intoId required" }, { status: 400 });

  return withOrgScope(async (orgId) => {
    const losing = await getLead(id, orgId);
    const winning = await getLead(intoId, orgId);
    if (!losing || !winning) {
      return Response.json({ error: "Lead not found" }, { status: 404 });
    }
    const merged = attachIntelligence(losing, winning, []);
    const saved = await patchLead(intoId, merged, orgId);
    await deleteLeads([id]);
    return Response.json({ lead: saved, mergedFromId: id });
  });
}
