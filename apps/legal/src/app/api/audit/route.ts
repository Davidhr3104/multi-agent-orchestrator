import { listAudit, recordAudit } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const events = await listAudit();
  return Response.json({ events });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { actor?: string; action?: string; detail?: string };
  const actor = body.actor?.trim() || "ops";
  const action = body.action?.trim() || "note";
  const detail = body.detail?.trim() || "";
  if (!detail) return Response.json({ error: "detail required" }, { status: 400 });
  const event = await recordAudit(actor, action, detail);
  return Response.json({ event });
}
