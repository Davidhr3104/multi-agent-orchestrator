import type { ColumnMapping, ImportContract, SheetGrid } from "@/lib/types";
import { headerKey } from "@/lib/utils";

export const IMPORT_CONTRACTS: ImportContract[] = [
  {
    app: "leads",
    name: "Helix for Leads intake",
    version: 1,
    maxRows: 5000,
    fields: [
      { name: "name", type: "text", required: true },
      { name: "email", type: "email", required: true },
      { name: "phone", type: "phone", required: false },
      { name: "company", type: "text", required: false },
      { name: "source", type: "text", required: false },
      { name: "message", type: "text", required: false },
      { name: "budget", type: "money", required: false },
      { name: "region", type: "text", required: false },
    ],
  },
  {
    app: "marketing",
    name: "Helix for Marketing spend",
    version: 1,
    maxRows: 5000,
    fields: [
      { name: "campaign_id", type: "text", required: true },
      { name: "name", type: "text", required: false },
      { name: "platform", type: "text", required: false },
      { name: "spend", type: "money", required: true },
      { name: "impressions", type: "number", required: false },
      { name: "clicks", type: "number", required: false },
      { name: "leads", type: "number", required: false },
      { name: "date", type: "date", required: false },
    ],
  },
  {
    app: "commerce",
    name: "Helix for Commerce catalog",
    version: 1,
    maxRows: 5000,
    fields: [
      { name: "sku", type: "text", required: true },
      { name: "name", type: "text", required: true },
      { name: "price", type: "money", required: false },
      { name: "inventory", type: "number", required: false },
    ],
  },
  {
    app: "real-estate",
    name: "Helix for Real Estate listings",
    version: 1,
    maxRows: 5000,
    fields: [
      { name: "title", type: "text", required: true },
      { name: "price", type: "money", required: true },
      { name: "zone", type: "text", required: false },
      { name: "address", type: "text", required: false },
    ],
  },
];

const ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "full_name", "contact", "lead"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "mobile", "tel", "telephone"],
  company: ["company", "account", "org", "organization"],
  source: ["source", "channel", "origin"],
  message: ["message", "notes", "comment"],
  budget: ["budget", "dealsize", "deal", "amount"],
  region: ["region", "city", "state", "country"],
  campaign_id: ["campaignid", "campaign", "id"],
  platform: ["platform", "channel"],
  spend: ["spend", "cost", "amount"],
  impressions: ["impressions", "imps"],
  clicks: ["clicks"],
  leads: ["leads", "formleads"],
  date: ["date", "day", "signupdate", "occurredat"],
  sku: ["sku", "skucode"],
  price: ["price", "amount"],
  inventory: ["inventory", "stock", "qty"],
  title: ["title", "listing", "name"],
  zone: ["zone", "neighborhood", "area"],
  address: ["address", "street"],
};

export function guessTargetApp(filename: string): ImportContract["app"] {
  const n = filename.toLowerCase();
  if (/(expense|spend|ad[-_ ]?cost|campaign|marketing|ads?)/.test(n)) return "marketing";
  if (/(sku|catalog|order|commerce|inventory|product)/.test(n)) return "commerce";
  if (/(listing|mls|propert|real[-_ ]?estate)/.test(n)) return "real-estate";
  return "leads";
}

export function contractFor(app: ImportContract["app"]): ImportContract {
  const found = IMPORT_CONTRACTS.find((c) => c.app === app);
  if (!found) throw new Error(`Unknown contract ${app}`);
  return found;
}

/** Header → contract field. Header names only — no model. */
export function mapColumns(grid: SheetGrid, contract: ImportContract): ColumnMapping[] {
  const used = new Set<string>();
  return grid.headers.map((column) => {
    const key = headerKey(column);
    let best: { field: string; confidence: number; evidence: string } | null = null;
    for (const field of contract.fields) {
      if (used.has(field.name)) continue;
      const aliases = ALIASES[field.name] ?? [headerKey(field.name)];
      if (aliases.includes(key) || key.includes(headerKey(field.name))) {
        best = { field: field.name, confidence: 0.92, evidence: `Header “${column}” matches ${field.name}.` };
        break;
      }
    }
    if (best) used.add(best.field);
    return {
      column,
      field: best?.field ?? null,
      confidence: best?.confidence ?? 0,
      evidence: best?.evidence ?? "Unmapped. Confirm before publish.",
    };
  });
}

export type RowValidation = {
  rowIndex: number;
  accepted: boolean;
  reasons: string[];
  payload: Record<string, string>;
};

export function validateAgainstContract(
  grid: SheetGrid,
  mapping: ColumnMapping[],
  contract: ImportContract
): RowValidation[] {
  const colForField = new Map<string, number>();
  mapping.forEach((m, i) => {
    if (m.field) colForField.set(m.field, i);
  });
  return grid.rows.map((row, rowIndex) => {
    const payload: Record<string, string> = {};
    const reasons: string[] = [];
    for (const field of contract.fields) {
      const idx = colForField.get(field.name);
      const value = idx === undefined ? "" : String(row[idx] ?? "").trim();
      if (field.required && !value) reasons.push(`Missing required ${field.name}.`);
      if (value) payload[field.name] = value;
    }
    return { rowIndex, accepted: reasons.length === 0, reasons, payload };
  });
}

export function publicationIdempotencyKey(versionHash: string, app: string, contractVersion: number): string {
  return `${app}@v${contractVersion}@${versionHash}`;
}
