import { parseSpendCsv } from "@helix/core";
import { ingestSpend } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let csv = "";
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const text = form.get("csv");
    csv = file instanceof File ? await file.text() : String(text ?? "");
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "JSON or CSV form required." }, { status: 400 });
    }
    const row = body as Record<string, unknown>;
    csv = String(row.csv ?? row.text ?? "");
  }
  if (!csv.trim()) return Response.json({ error: "csv is required." }, { status: 400 });
  const parsed = parseSpendCsv(csv);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }
  const campaigns = ingestSpend(parsed);
  return Response.json({ campaigns });
}
