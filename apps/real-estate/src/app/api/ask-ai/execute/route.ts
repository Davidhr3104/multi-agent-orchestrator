import { handleExecuteBody } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { aiCtx, mayChangeDesk } from "@/lib/ai-desk";
import { realEstateActions } from "@/lib/ai-actions";
import { logActivity } from "@/lib/store";

export const runtime = "nodejs";

type Body = { action?: unknown; labels?: unknown; targetIds?: unknown; entries?: { action?: unknown }[] };
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Closed allowlist: only actions registered in realEstateActions can run, and only after the agent
// confirmed them (a button click, the panel's Confirm, or the risk policy clearing them as safe).
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
  const ctx = aiCtx(req);
  const r = await handleExecuteBody(realEstateActions, body, ctx);
  if (r.status === 200) {
    const b = body as Body;
    const done = strs(r.body.done).length;
    const failed = Array.isArray(r.body.failed) ? r.body.failed.length : 0;
    const undo = b.action === "restore";
    const action = undo ? String(b.entries?.[0]?.action ?? "restore") : String(b.action);
    const labels = strs(b.labels).length ? strs(b.labels) : undo ? [] : strs(b.targetIds);
    if (done || failed) await logActivity({ actor: ctx.actor, action, kind: undo ? "undo" : "run", via: "button", labels, done, failed });
  }
  return Response.json(r.body, { status: r.status });
}
