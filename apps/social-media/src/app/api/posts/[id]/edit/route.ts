import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { saveDraft } from "@/lib/store";

export const runtime = "nodejs";

/** Saves caption, hashtags or the visual brief. A caption change on an approved post returns it to review. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { caption?: unknown; hashtags?: unknown; asset?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const hashtags = Array.isArray(body.hashtags) ? body.hashtags.filter((t): t is string => typeof t === "string") : undefined;
  try {
    const post = await saveDraft(
      id,
      {
        caption: typeof body.caption === "string" ? body.caption : undefined,
        hashtags,
        asset: typeof body.asset === "string" ? body.asset : undefined,
      },
      humanActor(req)
    );
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
