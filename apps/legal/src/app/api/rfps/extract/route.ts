import { pdfBufferToText } from "@/lib/pdf-text";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return Response.json({ error: "PDF only" }, { status: 400 });
  }
  if (file.size > 8_000_000) {
    return Response.json({ error: "PDF must be under 8MB" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const body = await pdfBufferToText(bytes);
    if (!body) {
      return Response.json({ error: "No extractable text in this PDF." }, { status: 422 });
    }
    const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
    return Response.json({ title, body, bytes: file.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 422 });
  }
}
