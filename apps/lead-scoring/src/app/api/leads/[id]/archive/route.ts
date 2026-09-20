import { patchLead } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { checkActionToken, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

async function archive(id: string, actor: string, orgId: string | undefined) {
  const lead = await patchLead(
    id,
    {
      needsReview: false,
      pipelineStage: "lost",
      reviewedBy: actor,
      reviewedAt: new Date().toISOString(),
    },
    orgId
  );
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  return withOrgScope((orgId) => archive(id, operatorActor(req), orgId));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenCheck = checkActionToken(req, id, "archive");
  if (tokenCheck instanceof Response) return tokenCheck;

  if (tokenCheck) {
    const res = await archive(id, "slack", tokenCheck.orgId);
    if (!res.ok) return res;
    return new Response("Archived. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
  }

  const denied = requireOperator(req);
  if (denied) return denied;
  return withOrgScope(async (orgId) => {
    const res = await archive(id, operatorActor(req), orgId);
    if (!res.ok) return res;
    return new Response("Archived. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
  });
}
