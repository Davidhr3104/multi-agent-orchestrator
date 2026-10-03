import { parseCsv } from "./csv";
import { LEAD_STAGES, type Financing, type Lead, type LeadStage, type Property, type PropertyKind, type PropertyStatus } from "./types";

/**
 * Turns a CSV (an upload or a published Google Sheet) into desk records. Every value comes from the file:
 * a required column that is empty or unreadable is reported as an error for that row, never filled in.
 */

export type ImportKind = "properties" | "buyers";
export const IMPORT_KINDS: ImportKind[] = ["properties", "buyers"];
export const isImportKind = (v: unknown): v is ImportKind => IMPORT_KINDS.includes(v as ImportKind);

export type FieldDef = { key: string; label: string; required: boolean; hint?: string; aliases: string[] };

export const PROPERTY_FIELDS: FieldDef[] = [
  { key: "ref", label: "Listing ID / MLS #", required: false, hint: "Keeps re-imports from duplicating a listing", aliases: ["id", "ref", "reference", "mls", "mls_id", "mls_number", "listing_id"] },
  { key: "title", label: "Title", required: false, hint: "Uses the address when empty", aliases: ["title", "name", "headline", "listing_title"] },
  { key: "address", label: "Address", required: true, aliases: ["address", "street", "street_address", "address_line_1", "full_address"] },
  { key: "zone", label: "Zone / neighborhood", required: true, aliases: ["zone", "neighborhood", "neighbourhood", "area", "district", "suburb", "city", "submarket"] },
  { key: "kind", label: "Type", required: true, hint: "apartment, condo, house, townhouse, penthouse, loft", aliases: ["type", "kind", "property_type", "home_type", "style"] },
  { key: "price", label: "Price (USD)", required: true, aliases: ["price", "price_usd", "list_price", "asking_price", "listing_price"] },
  { key: "sqm", label: "Size (m²)", required: false, hint: "Size in m² or ft² is required", aliases: ["sqm", "m2", "m²", "size_m2", "area_m2", "square_meters", "size_sqm"] },
  { key: "sqft", label: "Size (ft²)", required: false, hint: "Converted to m²", aliases: ["sqft", "sq_ft", "square_feet", "living_area", "size_sqft", "living_sqft", "ft2"] },
  { key: "beds", label: "Bedrooms", required: true, aliases: ["beds", "bedrooms", "bd", "br", "bed"] },
  { key: "baths", label: "Bathrooms", required: true, aliases: ["baths", "bathrooms", "ba", "bath", "full_baths"] },
  { key: "amenities", label: "Amenities", required: false, hint: "Separated by ; or |", aliases: ["amenities", "features", "extras"] },
  { key: "status", label: "Status", required: false, hint: "Empty means active", aliases: ["status", "listing_status", "state"] },
  { key: "daysOnMarket", label: "Days on market", required: false, aliases: ["days_on_market", "dom", "days_listed"] },
  { key: "description", label: "Description", required: false, aliases: ["description", "remarks", "public_remarks", "summary", "details"] },
];

export const BUYER_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full_name", "buyer", "contact", "contact_name"] },
  { key: "email", label: "Email", required: false, hint: "Email or phone is required", aliases: ["email", "email_address", "e_mail"] },
  { key: "phone", label: "Phone", required: false, aliases: ["phone", "mobile", "phone_number", "whatsapp", "cell"] },
  { key: "budget", label: "Budget (USD)", required: false, aliases: ["budget", "budget_usd", "max_budget", "max_price", "price_max"] },
  { key: "zones", label: "Zones", required: false, hint: "Separated by ; or |", aliases: ["zones", "zone", "areas", "neighborhoods", "preferred_zones", "location"] },
  { key: "bedsMin", label: "Min bedrooms", required: false, aliases: ["beds_min", "min_beds", "bedrooms", "beds", "min_bedrooms"] },
  { key: "timelineMonths", label: "Timeline (months)", required: false, aliases: ["timeline_months", "timeline", "move_in_months", "months"] },
  { key: "financing", label: "Financing", required: false, hint: "cash, preapproved, needs financing", aliases: ["financing", "finance", "mortgage", "funding"] },
  { key: "source", label: "Source", required: false, aliases: ["source", "lead_source", "channel", "origin"] },
  { key: "message", label: "Message / notes", required: false, aliases: ["message", "inquiry", "notes", "comments", "note"] },
  { key: "stage", label: "Stage", required: false, hint: "Empty means new", aliases: ["stage", "pipeline_stage", "lead_status"] },
  { key: "lastContactAt", label: "Last contact", required: false, aliases: ["last_contact_at", "last_contact", "last_contacted"] },
];

export const fieldsFor = (kind: ImportKind) => (kind === "properties" ? PROPERTY_FIELDS : BUYER_FIELDS);

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 2_000_000;
const SQFT_TO_SQM = 0.092903;

/** field key -> column index in the file, or null when the field is not mapped. */
export type ColumnMapping = Record<string, number | null>;
export type RowError = { row: number; messages: string[] };
export type ImportResult<T> = { headers: string[]; mapping: ColumnMapping; records: T[]; errors: RowError[]; total: number };

export const normalizeHeader = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[#().]/g, "")
    .replace(/[\s\-/]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

export function autoMap(kind: ImportKind, headers: string[]): ColumnMapping {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const f of fieldsFor(kind)) {
    const i = f.aliases.map((a) => norm.indexOf(a)).find((x) => x >= 0 && !used.has(x));
    mapping[f.key] = i === undefined ? null : i;
    if (i !== undefined) used.add(i);
  }
  return mapping;
}

/** Keeps only known fields pointing at real columns; anything else becomes unmapped. */
export function cleanMapping(kind: ImportKind, headers: string[], raw: unknown): ColumnMapping {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ColumnMapping = {};
  for (const f of fieldsFor(kind)) {
    const v = src[f.key];
    out[f.key] = Number.isInteger(v) && (v as number) >= 0 && (v as number) < headers.length ? (v as number) : null;
  }
  return out;
}

/** "$485,000", "485000", "485k", "1.2M" -> number; null when it isn't a number. */
export function parseMoney(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[$€£,\s]|usd/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const parseNum = (raw: string): number | null => {
  const s = raw.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

const splitList = (raw: string) =>
  [...new Set(raw.split(/[;|,]/).map((x) => x.trim()).filter(Boolean))].slice(0, 20);

export function parseKind(raw: string): PropertyKind | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/penthouse/.test(s)) return "penthouse";
  if (/loft|studio/.test(s)) return "loft";
  if (/town ?(house|home)|row ?house|duplex/.test(s)) return "townhouse";
  if (/apartment|apt|condo|flat|co-?op|unit/.test(s)) return "apartment";
  if (/house|single[ -]?family|detached|villa|home|bungalow|cottage/.test(s)) return "house";
  return null;
}

export function parseStatus(raw: string): PropertyStatus | null {
  const s = raw.trim().toLowerCase();
  if (!s) return "active";
  if (/draft|coming soon|off market|withdrawn|inactive|expired/.test(s)) return "draft";
  if (/sold|closed/.test(s)) return "sold";
  if (/pending|under contract|reserved|contingent/.test(s)) return "reserved";
  if (/active|for sale|available|listed|new/.test(s)) return "active";
  return null;
}

export function parseFinancing(raw: string): Financing | null {
  const s = raw.trim().toLowerCase();
  if (!s || /unknown|n\/a/.test(s)) return "unknown";
  if (/cash/.test(s)) return "cash";
  if (/pre-?approv/.test(s)) return "preapproved";
  if (/need|mortgage|loan|financ/.test(s)) return "needs_financing";
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isPhone = (raw: string) => /^\+?[\d\s().-]{7,20}$/.test(raw.trim()) && raw.replace(/\D/g, "").length >= 7;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "row";

const COVERS: [string, string][] = [
  ["#1B2A47", "#C9A24B"],
  ["#22324F", "#8FA3C4"],
  ["#0F1B33", "#D9B45C"],
  ["#2A3B5C", "#B5C2D9"],
];

type Cell = (key: string) => string;

function readRows(kind: ImportKind, csvText: string, rawMapping?: unknown) {
  if (csvText.length > MAX_IMPORT_BYTES) throw new Error(`The file is larger than ${MAX_IMPORT_BYTES / 1_000_000} MB.`);
  const [headerRow, ...data] = parseCsv(csvText);
  if (!headerRow) throw new Error("The file is empty.");
  if (data.length > MAX_IMPORT_ROWS) throw new Error(`The file has ${data.length} rows; the limit is ${MAX_IMPORT_ROWS}.`);
  const headers = headerRow.map((h) => h.trim());
  const mapping = rawMapping === undefined ? autoMap(kind, headers) : cleanMapping(kind, headers, rawMapping);
  const cellFor = (row: string[]): Cell => (key) => {
    const i = mapping[key];
    return i === null || i === undefined ? "" : (row[i] ?? "").trim();
  };
  return { headers, mapping, data, cellFor };
}

function missingMappings(kind: ImportKind, mapping: ColumnMapping): string[] {
  const missing = fieldsFor(kind)
    .filter((f) => f.required && mapping[f.key] === null)
    .map((f) => f.label);
  if (kind === "properties" && mapping.sqm === null && mapping.sqft === null) missing.push("Size (m² or ft²)");
  if (kind === "buyers" && mapping.email === null && mapping.phone === null) missing.push("Email or phone");
  return missing;
}

export function importProperties(csvText: string, rawMapping?: unknown): ImportResult<Property> {
  const { headers, mapping, data, cellFor } = readRows("properties", csvText, rawMapping);
  const missing = missingMappings("properties", mapping);
  if (missing.length) return { headers, mapping, records: [], errors: [{ row: 1, messages: [`Map a column for: ${missing.join(", ")}`] }], total: data.length };

  const records: Property[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  data.forEach((row, i) => {
    const line = i + 2;
    const c = cellFor(row);
    const msgs: string[] = [];
    const address = c("address");
    const zone = c("zone");
    if (!address) msgs.push("Address is empty");
    if (!zone) msgs.push("Zone is empty");
    const kind = parseKind(c("kind"));
    if (!kind) msgs.push(c("kind") ? `Type "${c("kind")}" isn't one of apartment, house, townhouse, penthouse, loft` : "Type is empty");
    const price = parseMoney(c("price"));
    if (!price || price <= 0) msgs.push(c("price") ? `Price "${c("price")}" isn't a number` : "Price is empty");
    const sqmRaw = c("sqm") ? parseNum(c("sqm")) : null;
    const sqftRaw = c("sqft") ? parseNum(c("sqft")) : null;
    const sqm = sqmRaw ?? (sqftRaw !== null ? sqftRaw * SQFT_TO_SQM : null);
    if (!sqm || sqm <= 0) msgs.push(c("sqm") || c("sqft") ? `Size "${c("sqm") || c("sqft")}" isn't a number` : "Size is empty");
    const beds = parseNum(c("beds"));
    if (beds === null || !Number.isInteger(beds)) msgs.push(c("beds") ? `Bedrooms "${c("beds")}" isn't a whole number` : "Bedrooms is empty");
    const baths = parseNum(c("baths"));
    if (baths === null) msgs.push(c("baths") ? `Bathrooms "${c("baths")}" isn't a number` : "Bathrooms is empty");
    const status = parseStatus(c("status"));
    if (!status) msgs.push(`Status "${c("status")}" isn't active, pending, sold or draft`);
    const domRaw = c("daysOnMarket");
    const dom = domRaw ? parseNum(domRaw) : 0;
    if (dom === null || !Number.isInteger(dom)) msgs.push(`Days on market "${domRaw}" isn't a whole number`);

    const id = `imp-${slug(c("ref") || address)}`;
    const dup = seen.get(id);
    if (dup) msgs.push(`Same listing as row ${dup}`);
    if (msgs.length) {
      errors.push({ row: line, messages: msgs });
      return;
    }
    seen.set(id, line);
    records.push({
      id,
      title: (c("title") || address).slice(0, 120),
      address: address.slice(0, 160),
      zone: zone.slice(0, 60),
      kind: kind!,
      price: price!,
      sqm: Math.round(sqm!),
      beds: beds!,
      baths: baths!,
      amenities: splitList(c("amenities")).map((a) => a.slice(0, 40)),
      status: status!,
      daysOnMarket: dom!,
      description: c("description").slice(0, 4000),
      cover: COVERS[records.length % COVERS.length],
    });
  });
  return { headers, mapping, records, errors, total: data.length };
}

export function importBuyers(csvText: string, rawMapping?: unknown, now = Date.now()): ImportResult<Lead> {
  const { headers, mapping, data, cellFor } = readRows("buyers", csvText, rawMapping);
  const missing = missingMappings("buyers", mapping);
  if (missing.length) return { headers, mapping, records: [], errors: [{ row: 1, messages: [`Map a column for: ${missing.join(", ")}`] }], total: data.length };

  const records: Lead[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  data.forEach((row, i) => {
    const line = i + 2;
    const c = cellFor(row);
    const msgs: string[] = [];
    const name = c("name");
    if (!name) msgs.push("Name is empty");
    const email = c("email").toLowerCase();
    const phone = c("phone");
    if (!email && !phone) msgs.push("Needs an email or a phone");
    if (email && !EMAIL.test(email)) msgs.push(`Email "${email}" isn't valid`);
    if (phone && !isPhone(phone)) msgs.push(`Phone "${phone}" isn't valid`);
    const budget = c("budget") ? parseMoney(c("budget")) : 0;
    if (budget === null) msgs.push(`Budget "${c("budget")}" isn't a number`);
    const bedsMin = c("bedsMin") ? parseNum(c("bedsMin")) : 0;
    if (bedsMin === null || !Number.isInteger(bedsMin)) msgs.push(`Min bedrooms "${c("bedsMin")}" isn't a whole number`);
    const timeline = c("timelineMonths") ? parseNum(c("timelineMonths")) : null;
    if (c("timelineMonths") && timeline === null) msgs.push(`Timeline "${c("timelineMonths")}" isn't a number of months`);
    const financing = parseFinancing(c("financing"));
    if (!financing) msgs.push(`Financing "${c("financing")}" isn't cash, preapproved or needs financing`);
    const stageRaw = c("stage").toLowerCase() || "new";
    if (!LEAD_STAGES.includes(stageRaw as LeadStage)) msgs.push(`Stage "${c("stage")}" isn't one of ${LEAD_STAGES.join(", ")}`);
    const last = c("lastContactAt");
    if (last && Number.isNaN(Date.parse(last))) msgs.push(`Last contact "${last}" isn't a date`);

    const id = `imp-lead-${slug(email || phone || name)}`;
    const dup = seen.get(id);
    if (dup) msgs.push(`Same buyer as row ${dup}`);
    if (msgs.length) {
      errors.push({ row: line, messages: msgs });
      return;
    }
    seen.set(id, line);
    records.push({
      id,
      name: name.slice(0, 80),
      email: email.slice(0, 120),
      phone: phone ? phone.slice(0, 40) : undefined,
      source: (c("source") || "Imported").slice(0, 40),
      message: c("message").slice(0, 2000),
      budget: budget!,
      zones: splitList(c("zones")).map((z) => z.slice(0, 60)),
      bedsMin: bedsMin!,
      timelineMonths: timeline === null ? null : Math.round(timeline),
      financing: financing!,
      stage: stageRaw as LeadStage,
      createdAt: new Date(now).toISOString(),
      lastContactAt: last ? new Date(last).toISOString() : undefined,
      notes: [],
    });
  });
  return { headers, mapping, records, errors, total: data.length };
}

/**
 * Accepts a Google Sheet link and returns its CSV export URL, or null when it isn't a Google Sheets link.
 * Works for sheets published to the web or shared as "Anyone with the link can view" — no sign-in needed.
 */
export function sheetCsvUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com" || !u.pathname.startsWith("/spreadsheets/d/")) return null;
  const published = u.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)\/pub(?:html)?/);
  if (published) {
    const gid = u.searchParams.get("gid");
    return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}`;
  }
  const m = u.pathname.match(/^\/spreadsheets\/d\/([\w-]{20,})/);
  if (!m) return null;
  const gid = u.searchParams.get("gid") ?? u.hash.match(/gid=(\d+)/)?.[1] ?? null;
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}`;
}

export async function fetchSheetCsv(link: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = sheetCsvUrl(link);
  if (!url) throw new Error("Paste a Google Sheets link (docs.google.com/spreadsheets/…).");
  const res = await fetchImpl(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Google Sheets answered ${res.status}. Publish the sheet to the web (File → Share → Publish to web → CSV) or share it as "Anyone with the link".`);
  const type = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (/text\/html/i.test(type) || /^\s*<!doctype html/i.test(text)) {
    throw new Error("Google returned a sign-in page, so the sheet isn't public. Publish it to the web as CSV or share it as \"Anyone with the link\".");
  }
  if (text.length > MAX_IMPORT_BYTES) throw new Error(`The sheet is larger than ${MAX_IMPORT_BYTES / 1_000_000} MB.`);
  return text;
}
