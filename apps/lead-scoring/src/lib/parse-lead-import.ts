import { parseLeadIngest, type LeadIngestInput } from "@helix/core";
import { parseCsv } from "@/lib/csv";

export const MAX_LEAD_IMPORT = 50;

export type LeadImportError = { row: number; error: string };

function asRecords(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.leads)) return obj.leads;
  if (obj.name && obj.email) return [obj];
  return [];
}

function csvRowToObject(row: Record<string, string>): Record<string, unknown> {
  const tags = row.tags
    ? row.tags
        .split(/[|,]/)
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;
  return {
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    source: row.source,
    message: row.message,
    budget: row.budget,
    timeline: row.timeline,
    city: row.city,
    state: row.state,
    country: row.country,
    region: row.region,
    tags,
  };
}

export function parseLeadImportPayload(
  body: unknown,
  filename = ""
): { inputs: LeadIngestInput[]; errors: LeadImportError[] } | { error: string } {
  let records: unknown[] = [];
  const lower = filename.toLowerCase();

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return { error: "Empty file." };
    if (lower.endsWith(".csv") || (!lower.endsWith(".json") && /,/.test(trimmed.split("\n")[0] ?? ""))) {
      records = parseCsv(trimmed).map(csvRowToObject);
    } else {
      try {
        records = asRecords(JSON.parse(trimmed));
      } catch {
        return { error: "Invalid JSON. Use an array, { leads: [...] }, or CSV with a name,email header." };
      }
    }
  } else {
    records = asRecords(body);
    if (records.length === 0 && body && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      if (typeof obj.text === "string") {
        return parseLeadImportPayload(obj.text, String(obj.filename ?? filename));
      }
    }
  }

  if (records.length === 0) {
    return { error: "No leads found. Send a JSON array, { leads: [...] }, or a CSV with name and email." };
  }
  if (records.length > MAX_LEAD_IMPORT) {
    return { error: `Too many rows (${records.length}). Max ${MAX_LEAD_IMPORT} per import.` };
  }

  const inputs: LeadIngestInput[] = [];
  const errors: LeadImportError[] = [];
  records.forEach((raw, i) => {
    const parsed = parseLeadIngest(raw);
    if (typeof parsed === "string") {
      errors.push({ row: i + 1, error: parsed });
      return;
    }
    inputs.push(parsed);
  });
  if (inputs.length === 0) {
    return { error: errors[0]?.error ?? "No valid leads in file." };
  }
  return { inputs, errors };
}
