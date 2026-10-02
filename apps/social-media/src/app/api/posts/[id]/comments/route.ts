import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { addComment } from "@/lib/store";
import type { DeskRole } from "@/lib/types";

export const runtime = "nodejs";

const ROLES: DeskRole[] = ["creator", "client", "admin"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { role?: unknown; body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (!ROLES.includes(body.role as DeskRole) || typeof body.body !== "string") {
    return Response.json({ error: "A comment needs a role and some text" }, { status: 400 });
  }
  const ok = await addComment(id, humanActor(req), body.role as DeskRole, body.body);
  if (!ok) return Response.json({ error: "Couldn't add that comment" }, { status: 400 });
  return Response.json({ ok: true });
}
