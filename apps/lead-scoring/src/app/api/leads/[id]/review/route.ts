import { patchLead } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { checkActionToken, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

async function clear(id: string, actor: string, orgId: string | undefined) {
  const lead = await patchLead(
    id,
    {
      needsReview: false,
      reviewedBy: actor,
      reviewedAt: new Date().toISOString(),
    },
    orgId
  );
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return lead;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  return withOrgScope(async (orgId) => {
    const lead = await clear(id, operatorActor(req), orgId);
    if (lead instanceof Response) return lead;
    return Response.json({ lead });
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenCheck = checkActionToken(req, id, "review");
  if (tokenCheck instanceof Response) return tokenCheck;

  if (tokenCheck) {
    const lead = await clear(id, "slack", tokenCheck.orgId);
    if (lead instanceof Response) return lead;
    return new Response("Approved. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
  }

  const denied = requireOperator(req);
  if (denied) return denied;
  return withOrgScope(async (orgId) => {
    const lead = await clear(id, operatorActor(req), orgId);
    if (lead instanceof Response) return lead;
    return new Response("Approved. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
  });
}
