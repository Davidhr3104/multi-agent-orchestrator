import { operatorActor } from "@helix/core/operator";
import { decide } from "@/lib/store";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const visitor = visitorFromRequest(req);
  let body: { changeIds?: string[]; status?: "approved" | "rejected" } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withVisitorCookie(req, Response.json({ error: "JSON required." }, { status: 400 }));
  }
  if (!Array.isArray(body.changeIds) || (body.status !== "approved" && body.status !== "rejected")) {
    return withVisitorCookie(req, Response.json({ error: "changeIds and status required." }, { status: 400 }));
  }
  const actor = operatorActor(req);
  const dataset = await decide(id, body.changeIds, body.status, actor, visitor.id);
  if (typeof dataset === "string") return withVisitorCookie(req, Response.json({ error: dataset }, { status: 404 }));
  return withVisitorCookie(req, Response.json({ dataset }));
}
