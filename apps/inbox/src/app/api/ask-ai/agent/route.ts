import { requireOperator } from "@helix/core/operator";
import { aiCtx, loadDeskState, mayChangeDesk, respondWithDeskCookie } from "@/lib/ai-desk";
import { continueAgent, newAgentCtx, verifyAgentState } from "@/lib/inbox-agent-session";
import { currentDeskMode } from "@/lib/store";

export const runtime = "nodejs";

/** The operator's decision on a paused Ask Helix step: { state, approved }. Approval runs the call once. */
export async function POST(req: Request) {
  let body: { state?: unknown; approved?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const approved = body.approved === true;
  if (approved && !mayChangeDesk(req)) {
    return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
  }
  const verified = verifyAgentState(body.state);
  if (!verified.ok) return Response.json({ error: verified.error }, { status: 400 });

  loadDeskState(req);
  const ctx = newAgentCtx(aiCtx(req), mayChangeDesk(req));
  try {
    const payload = await continueAgent(ctx, verified.state, approved);
    return respondWithDeskCookie(req, ctx, { ...payload, demo: currentDeskMode() === "demo" });
  } catch (err) {
    return respondWithDeskCookie(req, ctx, { error: err instanceof Error ? err.message : "Ask Helix failed" }, 409);
  }
}
