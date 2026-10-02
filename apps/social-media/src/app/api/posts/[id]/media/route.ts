import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { addMedia, removeMedia } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { action?: unknown; stockId?: unknown; libraryId?: unknown; url?: unknown; label?: unknown; kind?: unknown; mediaId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  try {
    if (body.action === "remove") {
      if (typeof body.mediaId !== "string") return Response.json({ error: "mediaId required" }, { status: 400 });
      const ok = await removeMedia(id, body.mediaId);
      if (!ok) return Response.json({ error: "Attachment not found" }, { status: 404 });
      return Response.json({ ok: true });
    }
    const post =
      typeof body.libraryId === "string"
        ? await addMedia(id, { libraryId: body.libraryId })
        : typeof body.stockId === "string"
          ? await addMedia(id, { stockId: body.stockId })
          : await addMedia(id, {
            url: typeof body.url === "string" ? body.url : "",
            label: typeof body.label === "string" ? body.label : "",
            kind: body.kind === "video" ? "video" : "image",
            source: "upload",
          });
    if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
