import { handleExecuteBody } from "@helix/core";
import { aiCtx, deskWriteDenied } from "@/lib/ai-desk";
import { socialActions } from "@/lib/ai-actions";

export const runtime = "nodejs";

// Closed allowlist: only actions registered in socialActions can run, and only after the operator
// confirmed them in the panel (or the risk policy cleared them as safe).
export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const r = await handleExecuteBody(socialActions, body, aiCtx(req));
  return Response.json(r.body, { status: r.status });
}
