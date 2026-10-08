import { ingestFile } from "@/lib/store";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const visitor = visitorFromRequest(req);
  const form = await req.formData().catch(() => null);
  if (!form) return withVisitorCookie(req, Response.json({ error: "multipart form required." }, { status: 400 }));
  const file = form.get("file");
  if (!(file instanceof File)) return withVisitorCookie(req, Response.json({ error: "file is required." }, { status: 400 }));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await ingestFile(file.name, bytes, false, visitor.id);
  if (typeof result === "string") return withVisitorCookie(req, Response.json({ error: result }, { status: 400 }));
  return withVisitorCookie(
    req,
    Response.json({
      id: result.dataset.id,
      dataset: result,
    })
  );
}
