import { timingSafeEqual } from "node:crypto";
import { getSecret, parseLeadIngest, type LeadIngestInput } from "@helix/core";

const MAX_FIELD = 4000;

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Single-tenant deployments (no Supabase orgs) accept intake only with HELIX_INTAKE_TOKEN. */
export function matchesSingleTenantIntakeToken(token: string): boolean {
  const expected = getSecret("HELIX_INTAKE_TOKEN");
  return Boolean(expected && token && safeEqual(token, expected));
}

/** Honeypot field names: real people never fill them, form bots usually do. */
const HONEYPOT_FIELDS = ["_gotcha", "_hp", "website_url"];

export type IntakeParse =
  | { ok: true; input: LeadIngestInput }
  | { ok: false; honeypot: true }
  | { ok: false; honeypot?: false; error: string };

/** Accepts application/json or an HTML form post (urlencoded / multipart). */
export async function parseIntakeRequest(req: Request): Promise<IntakeParse> {
  const type = req.headers.get("content-type") || "";
  let row: Record<string, unknown>;
  try {
    if (type.includes("application/json")) {
      row = (await req.json()) as Record<string, unknown>;
    } else if (type.includes("form")) {
      const form = await req.formData();
      row = {};
      for (const [k, v] of form.entries()) if (typeof v === "string") row[k] = v;
    } else {
      return { ok: false, error: "Send application/json or a form post." };
    }
  } catch {
    return { ok: false, error: "Body could not be parsed." };
  }
  if (!row || typeof row !== "object") return { ok: false, error: "JSON object required." };
  if (HONEYPOT_FIELDS.some((f) => String(row[f] ?? "").trim())) return { ok: false, honeypot: true };

  const first = String(row.first_name ?? row.firstName ?? "").trim();
  const last = String(row.last_name ?? row.lastName ?? "").trim();
  if (!row.name && (first || last)) row.name = `${first} ${last}`.trim();
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && v.length > MAX_FIELD) row[k] = v.slice(0, MAX_FIELD);
  }
  const parsed = parseLeadIngest(row);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  return { ok: true, input: parsed };
}
