import { ingestCatalogCsv, listCatalogDrafts } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const drafts = await listCatalogDrafts();
  return Response.json({ drafts });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let csv = "";
  let sourceFile: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const text = form.get("csv");
    if (file instanceof File) {
      csv = await file.text();
      sourceFile = file.name;
    } else if (typeof text === "string") {
      csv = text;
    }
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "JSON or CSV form required." }, { status: 400 });
    }
    const row = body as Record<string, unknown>;
    csv = String(row.csv ?? row.text ?? "");
    sourceFile = row.fileName != null ? String(row.fileName) : undefined;
  }

  if (!csv.trim()) {
    return Response.json({ error: "csv is required." }, { status: 400 });
  }

  const result = await ingestCatalogCsv(csv, sourceFile);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ drafts: result.drafts });
}
