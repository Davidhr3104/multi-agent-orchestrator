import { deskWriteDenied } from "@/lib/ai-desk";
import { DraftError, repurposePost } from "@/lib/store";
import type { Channel } from "@/lib/types";

export const runtime = "nodejs";

const CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];

/** Creates a draft on another channel from an approved post. Does not publish it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { channel?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (!CHANNELS.includes(body.channel as Channel)) return Response.json({ error: "Pick a channel" }, { status: 400 });
  try {
    const post = await repurposePost(id, body.channel as Channel);
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    if (err instanceof DraftError) return Response.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
