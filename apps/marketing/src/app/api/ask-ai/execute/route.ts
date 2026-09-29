import { handleExecuteBody } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { aiCtx, mayChangeDesk } from "@/lib/ai-desk";
import { marketingActions } from "@/lib/ai-actions";

export const runtime = "nodejs";

// Closed allowlist: only actions registered in marketingActions can run, and only after the operator
// confirmed them in the panel (or the risk policy cleared them as safe).
export async function POST(req: Request) {
  if (!mayChangeDesk(req)) {
    return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const r = await handleExecuteBody(marketingActions, body, aiCtx(req));
  return Response.json(r.body, { status: r.status });
}
