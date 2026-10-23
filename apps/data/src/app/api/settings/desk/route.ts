import { redactDeskStatus, settingsPrivileged, settingsWriteDenied } from "@helix/core";
import { deskStatus, goLiveEmpty, loadDemoCatalog } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return Response.json(redactDeskStatus(await deskStatus(), settingsPrivileged(req)));
}

export async function POST(req: Request) {
  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return Response.json({ error: "JSON required." }, { status: 400 });
  }
  if (body.action === "demo") {
    // loadDemoCatalog clears every bundle. That is fine for the public sandbox
    // and not fine for a live desk unless the caller is authenticated.
    const status = await deskStatus();
    if (status.mode !== "demo") {
      const denied = settingsWriteDenied(req);
      if (denied) return denied;
    }
    return Response.json(await loadDemoCatalog());
  }
  if (body.action === "empty") {
    const denied = settingsWriteDenied(req);
    if (denied) return denied;
    return Response.json(await goLiveEmpty());
  }
  return Response.json({ error: "action must be demo or empty." }, { status: 400 });
}
