import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { rewriteCaption } from "@/lib/store";
import type { RewriteAction } from "@/lib/copilot";

export const runtime = "nodejs";

const ACTIONS: RewriteAction[] = ["concise", "emojis", "professional", "cta"];

/** Rewrites the selected fragment, or the whole caption when no range is selected. Records a revision. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { action?: unknown; start?: unknown; end?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (!ACTIONS.includes(body.action as RewriteAction)) return Response.json({ error: "Unknown rewrite action" }, { status: 400 });
  const start = typeof body.start === "number" ? body.start : 0;
  const end = typeof body.end === "number" ? body.end : 0;
  try {
    const post = await rewriteCaption(id, body.action as RewriteAction, start, end, humanActor(req));
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
