import { dryRunPublish } from "@/lib/store";
import type { ImportContract } from "@/lib/types";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const visitor = visitorFromRequest(req);
  let body: { targetApp?: ImportContract["app"] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withVisitorCookie(req, Response.json({ error: "JSON required." }, { status: 400 }));
  }
  const result = await dryRunPublish(id, body.targetApp ?? "leads", visitor.id);
  if (typeof result === "string") return withVisitorCookie(req, Response.json({ error: result }, { status: 404 }));
  return withVisitorCookie(req, Response.json(result));
}
