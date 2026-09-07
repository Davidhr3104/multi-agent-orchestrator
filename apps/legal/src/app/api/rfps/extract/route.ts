import { docxBufferToText } from "@/lib/docx-text";
import { pdfBufferToText } from "@/lib/pdf-text";

export const runtime = "nodejs";

const MAX_BYTES = 8_000_000;

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}

function titleFromFilename(name: string): string {
  return name
    .replace(/\.(pdf|docx|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort issuer from early lines (e.g. "Issued by: Acme LLP"). */
function guessIssuer(body: string): string | undefined {
  const head = body.slice(0, 2500);
  const patterns = [
    /(?:issued\s+by|issuer|soliciting\s+(?:agency|entity)|from)\s*[:\-–]\s*([^\n]{3,80})/i,
    /(?:department|office|consortium|llp|llc|inc\.?)\s+of\s+[^\n]{3,60}/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ").slice(0, 120);
    if (m?.[0] && !m[1]) return m[0].trim().slice(0, 120);
  }
  return undefined;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File must be under 8MB" }, { status: 400 });
  }

  const ext = extOf(file.name);
  const mime = file.type;
  const isPdf = ext === "pdf" || mime === "application/pdf";
  const isDocx =
    ext === "docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isTxt = ext === "txt" || mime === "text/plain";

  if (!isPdf && !isDocx && !isTxt) {
    return Response.json({ error: "PDF, DOCX, or TXT only" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    let body = "";
    if (isPdf) body = await pdfBufferToText(bytes);
    else if (isDocx) body = await docxBufferToText(bytes);
    else body = new TextDecoder("utf-8").decode(bytes).trim();

    if (!body || body.length < 40) {
      return Response.json(
        {
          error: isPdf
            ? "No extractable text in this PDF (scanned image-only files need OCR)."
            : "Document text too short to score.",
        },
        { status: 422 }
      );
    }

    const title = titleFromFilename(file.name);
    const issuer = guessIssuer(body);
    const preview = body.slice(0, 1400);
    return Response.json({
      title,
      issuer: issuer ?? "",
      body,
      preview,
      bytes: file.size,
      format: isPdf ? "pdf" : isDocx ? "docx" : "txt",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 422 });
  }
}
