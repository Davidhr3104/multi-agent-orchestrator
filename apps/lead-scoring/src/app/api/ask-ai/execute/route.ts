import type { PipelineStage } from "@helix/core";
import { AI_ACTIONS, AI_ADVANCE_STAGES, aiActor, runAiAction, type AiActionPayload } from "@/lib/ai-actions";
import { operatorActor } from "@helix/core/operator";
import { requireOperatorOrGuest } from "@/lib/org-auth";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

// Closed allowlist: this route only ever runs actions a human confirmed (or that the risk
// policy in ai-risk.ts cleared as safe and reversible).
export async function POST(req: Request) {
  const denied = await requireOperatorOrGuest(req);
  if (denied) return denied;

  const body = (await req.json()) as Partial<AiActionPayload>;

  if (!AI_ACTIONS.includes(body.action as (typeof AI_ACTIONS)[number])) {
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  }
  if (body.action === "restore") {
    if (!Array.isArray(body.snapshots) || body.snapshots.length === 0) {
      return Response.json({ error: "snapshots must be a non-empty array" }, { status: 400 });
    }
  } else if (!Array.isArray(body.targetIds) || body.targetIds.length === 0) {
    return Response.json({ error: "targetIds must be a non-empty array" }, { status: 400 });
  }
  if (body.action === "advance_stage" && !AI_ADVANCE_STAGES.includes(body.stage as PipelineStage)) {
    return Response.json({ error: `stage must be one of: ${AI_ADVANCE_STAGES.join(", ")}` }, { status: 400 });
  }
  if (body.action === "add_note" && !body.note?.trim()) {
    return Response.json({ error: "note is required" }, { status: 400 });
  }

  return withOrgScope(async (orgId): Promise<Response> => {
    const actor = aiActor(operatorActor(req));
    const result = await runAiAction({ ...(body as AiActionPayload), targetIds: body.targetIds ?? [] }, actor, orgId);
    return Response.json({ action: body.action, ...result });
  });
}
