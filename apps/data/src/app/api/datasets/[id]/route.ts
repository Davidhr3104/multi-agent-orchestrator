import { getBundle, setMapping } from "@/lib/store";
import type { ImportContract } from "@/lib/types";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const visitor = visitorFromRequest(req);
  const dataset = await getBundle(id, visitor.id);
  if (!dataset) return withVisitorCookie(req, Response.json({ error: "Dataset not found." }, { status: 404 }));
  return withVisitorCookie(req, Response.json({ dataset }));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const visitor = visitorFromRequest(req);
  let body: { targetApp?: ImportContract["app"]; mapping?: { column: string; field: string | null }[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withVisitorCookie(req, Response.json({ error: "JSON required." }, { status: 400 }));
  }
  if (!body.targetApp) return withVisitorCookie(req, Response.json({ error: "targetApp required." }, { status: 400 }));
  const dataset = await setMapping(id, body.targetApp, body.mapping, visitor.id);
  if (typeof dataset === "string") return withVisitorCookie(req, Response.json({ error: dataset }, { status: 404 }));
  return withVisitorCookie(req, Response.json({ dataset }));
}
