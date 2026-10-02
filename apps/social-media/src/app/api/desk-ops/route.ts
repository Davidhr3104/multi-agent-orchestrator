import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { addWebhook, createReport, listWebhooks } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await listWebhooks());
}

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { action?: unknown; url?: unknown; events?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  try {
    if (body.action === "report") return Response.json({ report: await createReport() });
    if (body.action === "webhook" && typeof body.url === "string") {
      const events = Array.isArray(body.events) ? body.events.filter((event): event is string => typeof event === "string") : ["post.approved"];
      return Response.json({ hook: await addWebhook(body.url, events) });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
