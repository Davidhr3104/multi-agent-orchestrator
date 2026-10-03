import { isDemoRecordId } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { getLead, patchLead } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";
import { draftNextMove } from "@/lib/next-move";

export const runtime = "nodejs";

/**
 * body.action:
 *  - "draft"   Claude writes a next-best-move draft from this lead's stored data.
 *  - "approve" a human accepts the draft (optionally edited via body.message). Helix sends nothing:
 *              the operator copies it into their email/phone tool.
 *  - "dismiss" the draft is discarded.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { action?: string; message?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const action = body.action ?? "draft";

  return withOrgScope(async (orgId) => {
    const lead = await getLead(id, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

    if (action === "draft") {
      if (isDemoRecordId(lead.id)) {
        return Response.json(
          { error: "Demo lead: AI drafts are only written for real leads.", lead },
          { status: 409 }
        );
      }
      const result = await draftNextMove(lead, "operator");
      if (!result.ok) return Response.json({ error: result.error, lead }, { status: 409 });
      const saved = await patchLead(id, { nextMove: result.draft }, orgId);
      return Response.json({ lead: saved ?? lead, nextMove: result.draft });
    }

    if (action === "approve" || action === "dismiss") {
      if (!lead.nextMove) return Response.json({ error: "No draft to decide on." }, { status: 409 });
      const edited = typeof body.message === "string" && body.message.trim() ? body.message.trim() : undefined;
      const nextMove = {
        ...lead.nextMove,
        message: action === "approve" && edited ? edited : lead.nextMove.message,
        status: action === "approve" ? ("approved" as const) : ("dismissed" as const),
        decidedBy: operatorActor(req),
        decidedAt: new Date().toISOString(),
      };
      const saved = await patchLead(id, { nextMove }, orgId);
      return Response.json({ lead: saved ?? lead, nextMove });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  });
}
