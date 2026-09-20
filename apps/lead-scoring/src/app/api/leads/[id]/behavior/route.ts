import { applyBehavior, isBehaviorKind } from "@helix/core";
import { getLead, saveLead } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const kind = String((body as { kind?: string }).kind ?? "");
  if (!isBehaviorKind(kind)) {
    return Response.json({ error: "Invalid behavior kind" }, { status: 400 });
  }
  return withOrgScope(async (orgId) => {
    const current = await getLead(id, orgId);
    if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });
    const lead = await saveLead(applyBehavior(current, kind), orgId);
    return Response.json({ lead });
  });
}
