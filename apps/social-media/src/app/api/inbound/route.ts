import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { acceptInbound, dismissInbound } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { action?: unknown; id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (typeof body.id !== "string") return Response.json({ error: "id required" }, { status: 400 });
  try {
    if (body.action === "accept") {
      const post = await acceptInbound(body.id, "You");
      if (!post) return Response.json({ error: "That inbound draft is not waiting." }, { status: 404 });
      return Response.json({ id: post.id });
    }
    if (body.action === "dismiss") {
      const ok = await dismissInbound(body.id);
      if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
