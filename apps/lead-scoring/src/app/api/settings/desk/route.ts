import { clearDesk, deskStatus, loadDemoCatalog } from "@/lib/store";
import { redactDeskStatus, settingsDeskWriteDenied, settingsPrivileged } from "@helix/core";
import { leadsSettingsAuth } from "@/lib/settings-session";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await leadsSettingsAuth();
  return withOrgScope(async (orgId) =>
    Response.json(redactDeskStatus(await deskStatus(orgId), settingsPrivileged(req, { session: auth.session || Boolean(orgId) })))
  );
}

export async function POST(req: Request) {
  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return Response.json({ error: "JSON required." }, { status: 400 });
  }
  const auth = await leadsSettingsAuth();
  return withOrgScope(async (orgId) => {
    if (body.action === "demo") {
      // Sandbox only — applyDemoCatalog never writes the live store.
      return Response.json(await loadDemoCatalog(orgId));
    }
    if (body.action === "empty") {
      const denied = settingsDeskWriteDenied(req, body.action, { session: auth.session || Boolean(orgId) });
      if (denied) return denied;
      return Response.json(await clearDesk(orgId));
    }
    return Response.json({ error: "action must be demo or empty." }, { status: 400 });
  });
}
