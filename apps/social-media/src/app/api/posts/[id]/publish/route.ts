import { requireOperator } from "@helix/core/operator";
import { humanActor, deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { publishApprovedPost } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** A person pressed Publish on one approved post. Requires HELIX_SOCIAL_PUBLISH=live; AI actions never call this. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Real posts on the operator's Meta/LinkedIn accounts: the operator key is needed on any desk.
  const denied = requireOperator(req) ?? deskWriteDenied(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== true) return Response.json({ error: "Confirm this post before publishing." }, { status: 400 });
  const { id } = await ctx.params;
  try {
    const post = await publishApprovedPost(id, humanActor(req));
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post, publication: post.publication });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
