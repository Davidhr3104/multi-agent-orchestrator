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
  if (body.action === "demo") return Response.json(await loadDemoCatalog());
  if (body.action === "empty") return Response.json(await clearDesk());
  return Response.json({ error: "action must be demo or empty." }, { status: 400 });
}
