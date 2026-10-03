import { requireOperator } from "@helix/core/operator";
import { aiCtx, deskWriteDenied } from "@/lib/ai-desk";
import { fetchSheetCsv, fieldsFor, importBuyers, importProperties, isImportKind } from "@/lib/import";
import { deskStatus, importRecords, logActivity } from "@/lib/store";
import type { Lead, Property } from "@/lib/types";

export const runtime = "nodejs";

type Body = { kind?: unknown; csv?: unknown; sheetUrl?: unknown; mapping?: unknown; commit?: unknown };

const sampleProperty = (p: Property) => ({ title: p.title, address: p.address, zone: p.zone, kind: p.kind, price: p.price, sqm: p.sqm, beds: p.beds, baths: p.baths, status: p.status });
const sampleLead = (l: Lead) => ({ name: l.name, email: l.email, phone: l.phone ?? "", budget: l.budget, zones: l.zones.join(", "), bedsMin: l.bedsMin, financing: l.financing, stage: l.stage });

/**
 * Previews (commit: false) or imports (commit: true) listings or buyers from a CSV upload or a public Google Sheet.
 * The first import replaces the sample agency with the agent's own data.
 */
export async function POST(req: Request) {
  // Stricter than other writes: on a public demo deployment with an operator key, visitors can't replace the shared desk.
  const denied = requireOperator(req) ?? deskWriteDenied(req);
  if (denied) return denied;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "JSON body required." }, { status: 400 });
  }
  if (!isImportKind(body.kind)) return Response.json({ error: "kind must be properties or buyers." }, { status: 400 });
  const kind = body.kind;

  let text: string;
  let origin: "csv" | "sheet";
  try {
    if (typeof body.sheetUrl === "string" && body.sheetUrl.trim()) {
      text = await fetchSheetCsv(body.sheetUrl);
      origin = "sheet";
    } else if (typeof body.csv === "string" && body.csv.trim()) {
      text = body.csv;
      origin = "csv";
    } else return Response.json({ error: "Upload a CSV file or paste a Google Sheets link." }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't read the sheet." }, { status: 422 });
  }

  let result;
  try {
    result = kind === "properties" ? importProperties(text, body.mapping) : importBuyers(text, body.mapping);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't read the file." }, { status: 422 });
  }
  const status = await deskStatus();
  const preview = {
    kind,
    origin,
    headers: result.headers,
    mapping: result.mapping,
    fields: fieldsFor(kind).map(({ key, label, required, hint }) => ({ key, label, required, hint: hint ?? null })),
    total: result.total,
    valid: result.records.length,
    errors: result.errors.slice(0, 200),
    errorCount: result.errors.length,
    sample: kind === "properties" ? (result.records as Property[]).slice(0, 5).map(sampleProperty) : (result.records as Lead[]).slice(0, 5).map(sampleLead),
    willClearDemo: status.demo,
  };
  if (body.commit !== true) return Response.json(preview);

  if (!result.records.length) return Response.json({ ...preview, error: "No valid rows to import." }, { status: 422 });
  const outcome = await importRecords(kind === "properties" ? { properties: result.records as Property[] } : { leads: result.records as Lead[] });
  await logActivity({
    actor: aiCtx(req).actor,
    action: kind === "properties" ? "import_listings" : "import_buyers",
    kind: "run",
    via: "button",
    labels: [`${result.records.length} ${kind === "properties" ? "listings" : "buyers"} from ${origin === "sheet" ? "Google Sheets" : "CSV"}`],
    done: result.records.length,
    failed: result.errors.length,
  });
  return Response.json({ ...preview, imported: outcome });
}
