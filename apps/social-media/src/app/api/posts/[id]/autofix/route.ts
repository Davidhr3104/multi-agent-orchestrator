import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { autoFixPost, previewAutoFix } from "@/lib/store";

export const runtime = "nodejs";

/** Rewrites the draft until every readiness rule scores full marks. Does not publish it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let preview = false;
  try {
    const body = (await req.json()) as { preview?: unknown };
    preview = body.preview === true;
  } catch {
    preview = false;
  }
  try {
    if (preview) {
      const diff = await previewAutoFix(id);
      if (!diff) return Response.json({ error: "Post not found" }, { status: 404 });
      return Response.json(diff);
    }
    const post = await autoFixPost(id, humanActor(req));
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
