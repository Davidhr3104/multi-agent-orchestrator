import { deskWriteDenied } from "@/lib/ai-desk";
import { deskStatus, loadDemoCatalog } from "@/lib/store";

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
  if (body.action !== "demo") return Response.json({ error: "action must be demo." }, { status: 400 });
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  if ((await deskStatus()).imported) return Response.json({ error: "Your imported data is on this desk, so the demo can't be loaded over it." }, { status: 409 });
  try {
    return Response.json(await loadDemoCatalog());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not load demo" }, { status: 409 });
  }
}
