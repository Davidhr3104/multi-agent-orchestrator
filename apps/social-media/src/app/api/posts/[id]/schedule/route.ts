import { deskWriteDenied } from "@/lib/ai-desk";
import { reschedulePost } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { when?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (typeof body.when !== "string" || Number.isNaN(Date.parse(body.when))) {
    return Response.json({ error: "A valid date is required" }, { status: 400 });
  }
  const ok = await reschedulePost(id, body.when);
  if (!ok) return Response.json({ error: "Post not found" }, { status: 404 });
  return Response.json({ ok: true });
}
