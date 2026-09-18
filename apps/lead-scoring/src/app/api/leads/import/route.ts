import { isClaudeConfigured } from "@helix/core";
import { parseLeadImportPayload } from "@/lib/parse-lead-import";
import { persistIngestedLead } from "@/lib/persist-lead";

export const runtime = "nodejs";

async function readImportBody(req: Request): Promise<{ body: unknown; filename: string } | { error: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") ?? form.get("leads");
    if (file instanceof File) {
      return { body: await file.text(), filename: file.name };
    }
    const text = form.get("text");
    if (typeof text === "string") {
      return { body: text, filename: String(form.get("filename") ?? "") };
    }
    return { error: "Attach a .json or .csv file." };
  }
  try {
    return { body: await req.json(), filename: "" };
  } catch {
    return { error: "Invalid JSON or multipart body." };
  }
}

export async function POST(req: Request) {
  const raw = await readImportBody(req);
  if ("error" in raw) {
    return Response.json({ error: raw.error }, { status: 400 });
  }

  const parsed = parseLeadImportPayload(raw.body, raw.filename);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const leads = [];
  const errors = [...parsed.errors];
  for (const [i, input] of parsed.inputs.entries()) {
    try {
      leads.push(await persistIngestedLead(input));
    } catch (err) {
      errors.push({
        row: i + 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json({
    imported: leads.length,
    engine: isClaudeConfigured() ? "claude" : "heuristic",
    leads,
    errors,
  });
}
