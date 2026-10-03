import { clearDesk, deskStatus, loadDemoCatalog } from "@/lib/store";
import { requireOperator } from "@helix/core/operator";
import { deskWriteDenied, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET() {
  return withOrgScope(async (orgId) => Response.json(await deskStatus(orgId)));
}

export async function POST(req: Request) {
  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return Response.json({ error: "JSON required." }, { status: 400 });
  }
  return withOrgScope(async (orgId) => {
    if (body.action === "demo") {
      const denied = await deskWriteDenied(req);
      if (denied) return denied;
      return Response.json(await loadDemoCatalog(orgId));
    }
    if (body.action === "empty") {
      // Without an org the desk is shared: leaving the demo flips it to live for every visitor.
      if (!orgId) {
        const denied = requireOperator(req);
        if (denied) return denied;
      }
      return Response.json(await clearDesk(orgId));
    }
    return Response.json({ error: "action must be demo or empty." }, { status: 400 });
  });
}
