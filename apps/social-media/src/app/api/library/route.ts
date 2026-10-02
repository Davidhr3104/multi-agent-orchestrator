import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { addLibraryAsset, listAssets, setAssetApproval } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ assets: await listAssets() });
}

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { action?: unknown; id?: unknown; approved?: unknown; name?: unknown; folder?: unknown; tags?: unknown; url?: unknown; prompt?: unknown; kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  try {
    if (body.action === "approve" && typeof body.id === "string") {
      const ok = await setAssetApproval(body.id, body.approved !== false);
      if (!ok) return Response.json({ error: "Asset not found" }, { status: 404 });
      return Response.json({ ok: true });
    }
    const tags = Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [];
    const asset = await addLibraryAsset({
      name: typeof body.name === "string" ? body.name : "",
      folder: typeof body.folder === "string" ? body.folder : "General",
      tags,
      url: typeof body.url === "string" ? body.url : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      kind: body.kind === "video" || body.kind === "logo" || body.kind === "prompt" || body.kind === "image" ? body.kind : undefined,
    });
    return Response.json({ asset });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
