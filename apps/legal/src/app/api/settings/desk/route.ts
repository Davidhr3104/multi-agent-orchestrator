import { requireOperator } from "@helix/core/operator";
import { deskWriteDenied } from "@/lib/ai-desk";
import { clearDesk, deskStatus, loadDemoCatalog } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await deskStatus());
}

export async function POST(req: Request) {
  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return Response.json({ error: "JSON required." }, { status: 400 });
  }
  if (body.action === "demo") {
    const denied = deskWriteDenied(req);
    if (denied) return denied;
    try {
      return Response.json(await loadDemoCatalog());
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "Could not load demo" }, { status: 409 });
    }
  }
  if (body.action === "empty") {
    // Leaving the demo flips the shared desk to live for every visitor, so it always needs the operator.
    const denied = requireOperator(req);
    if (denied) return denied;
    return Response.json(await clearDesk());
  }
  return Response.json({ error: "action must be demo or empty." }, { status: 400 });
}
