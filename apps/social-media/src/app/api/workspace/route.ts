import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { createWorkspace, setApprovalMode, setPlan, setSessionRole, shellSession, switchWorkspace } from "@/lib/store";
import type { AccessRole, ApprovalMode, PlanId } from "@/lib/types";

export const runtime = "nodejs";

const ROLES: AccessRole[] = ["owner", "manager", "creator", "client"];
const MODES: ApprovalMode[] = ["manager", "manager_then_client"];
const PLANS: PlanId[] = ["starter", "pro"];

export async function GET() {
  return Response.json(await shellSession());
}

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { action?: unknown; id?: unknown; name?: unknown; role?: unknown; mode?: unknown; plan?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  try {
    if (body.action === "switch" && typeof body.id === "string") return Response.json(await switchWorkspace(body.id));
    if (body.action === "create" && typeof body.name === "string") return Response.json(await createWorkspace(body.name));
    if (body.action === "role" && ROLES.includes(body.role as AccessRole)) return Response.json(await setSessionRole(body.role as AccessRole));
    if (body.action === "approval" && MODES.includes(body.mode as ApprovalMode)) return Response.json(await setApprovalMode(body.mode as ApprovalMode));
    if (body.action === "plan" && PLANS.includes(body.plan as PlanId)) return Response.json(await setPlan(body.plan as PlanId));
    return Response.json({ error: "Unknown workspace action" }, { status: 400 });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
