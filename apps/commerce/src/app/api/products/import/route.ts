import { isClaudeConfigured } from "@helix/core";
import { parseProductCatalogCsv } from "@/lib/parse-catalog";
import { importCatalog, listProducts } from "@/lib/store";

export const runtime = "nodejs";

async function readCsvText(req: Request): Promise<{ text: string; mode: "merge" | "replace" } | { error: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") ?? form.get("catalog");
    const modeRaw = String(form.get("mode") ?? "merge").toLowerCase();
    const mode = modeRaw === "replace" ? "replace" : "merge";
    if (file instanceof File) {
      return { text: await file.text(), mode };
    }
    const text = form.get("text");
    if (typeof text === "string" && text.trim()) return { text, mode };
    return { error: "Attach a catalog CSV." };
  }
  try {
    const body = (await req.json()) as { text?: string; csv?: string; mode?: string };
    const text = body.text ?? body.csv ?? "";
    if (!text.trim()) return { error: "CSV text required." };
    const mode = body.mode === "replace" ? "replace" : "merge";
    return { text, mode };
  } catch {
    return { error: "Invalid JSON or multipart body." };
  }
}

export async function POST(req: Request) {
  const raw = await readCsvText(req);
  if ("error" in raw) {
    return Response.json({ error: raw.error }, { status: 400 });
  }
  const parsed = parseProductCatalogCsv(raw.text);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const imported = await importCatalog(parsed.inputs, raw.mode);
  const products = await listProducts();
  return Response.json({
    imported: imported.length,
    mode: raw.mode,
    engine: isClaudeConfigured() ? "claude" : "heuristic",
    products,
  });
}

export async function GET() {
  const products = await listProducts();
  return Response.json({ products });
}
