import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { reviewPost } from "@/lib/store";

export const runtime = "nodejs";

const DECISIONS = ["approve", "changes", "submit"] as const;
type Decision = (typeof DECISIONS)[number];

/** A person's decision from the post page. Approving records a sign-off only; nothing is published. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { decision?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (!DECISIONS.includes(body.decision as Decision)) return Response.json({ error: "decision must be approve, changes or submit" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note : undefined;
  try {
    const post = await reviewPost(id, body.decision as Decision, humanActor(req), note);
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
