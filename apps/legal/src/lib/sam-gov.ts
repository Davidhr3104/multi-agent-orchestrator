import { getSecret } from "@helix/core";

export const SAM_GOV_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";
const SAM_API_HOST = "api.sam.gov";
const MAX_RANGE_DAYS = 365;

/** Procurement types accepted by the `ptype` parameter (one value per request). */
export const SAM_PROCUREMENT_TYPES: Record<string, string> = {
  o: "Solicitation",
  k: "Combined Synopsis/Solicitation",
  p: "Presolicitation",
  r: "Sources Sought",
  s: "Special Notice",
  a: "Award Notice",
  u: "Justification (J&A)",
  g: "Sale of Surplus Property",
  i: "Intent to Bundle Requirements",
};

export type SamSearchFilters = {
  postedFrom: Date;
  postedTo: Date;
  limit: number;
  offset?: number;
  /** NAICS code, up to 6 digits. */
  ncode?: string;
  ptype?: string;
  /** SAM.gov's keyword search matches the notice title. */
  title?: string;
  /** Place-of-performance state, 2-letter code. */
  state?: string;
  typeOfSetAside?: string;
};

type SamPlace = {
  city?: { name?: string } | null;
  state?: { code?: string; name?: string } | null;
  country?: { code?: string; name?: string } | null;
} | null;

export type SamOpportunity = {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string | null;
  fullParentPathName?: string | null;
  department?: string | null;
  subTier?: string | null;
  subtier?: string | null;
  office?: string | null;
  postedDate?: string | null;
  type?: string | null;
  baseType?: string | null;
  typeOfSetAside?: string | null;
  typeOfSetAsideDescription?: string | null;
  setAside?: string | null;
  responseDeadLine?: string | null;
  reponseDeadLine?: string | null;
  naicsCode?: string | null;
  classificationCode?: string | null;
  active?: string | null;
  description?: string | null;
  uiLink?: string | null;
  additionalInfoLink?: string | null;
  resourceLinks?: string[] | null;
  placeOfPerformance?: SamPlace;
  pointOfContact?: { fullName?: string; email?: string; type?: string }[] | null;
};

export type SamErrorKind =
  | "not_configured"
  | "invalid_filters"
  | "rate_limited"
  | "unauthorized"
  | "bad_request"
  | "upstream"
  | "network"
  | "invalid_response";

export type SamError = {
  kind: SamErrorKind;
  message: string;
  status?: number;
  retryAfterSeconds?: number;
};

export type SamSearchResult =
  | {
      ok: true;
      totalRecords: number;
      opportunities: SamOpportunity[];
      rateLimitRemaining?: number;
    }
  | { ok: false; error: SamError };

export type SamDescriptionResult =
  | { status: "fetched"; text: string }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; error: SamError };

type FetchOpts = { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number };

export function samApiKey(): string {
  return getSecret("SAM_GOV_API_KEY");
}

export function isSamConfigured(): boolean {
  return Boolean(samApiKey());
}

/** SAM.gov wants MM/dd/yyyy. Uses UTC so the same instant always formats the same way. */
export function formatSamDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

export function validateSamFilters(f: SamSearchFilters): string | null {
  if (!(f.postedFrom instanceof Date) || Number.isNaN(f.postedFrom.getTime())) return "postedFrom is not a valid date.";
  if (!(f.postedTo instanceof Date) || Number.isNaN(f.postedTo.getTime())) return "postedTo is not a valid date.";
  if (f.postedFrom.getTime() > f.postedTo.getTime()) return "postedFrom must be on or before postedTo.";
  if ((f.postedTo.getTime() - f.postedFrom.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    return "SAM.gov only accepts a posted-date range of up to 1 year.";
  }
  if (!Number.isInteger(f.limit) || f.limit < 1 || f.limit > 1000) return "limit must be between 1 and 1000.";
  if (f.offset != null && (!Number.isInteger(f.offset) || f.offset < 0)) return "offset must be a positive number.";
  if (f.ncode && !/^\d{2,6}$/.test(f.ncode)) return "NAICS code must be 2 to 6 digits.";
  if (f.ptype && !SAM_PROCUREMENT_TYPES[f.ptype]) return `Unknown procurement type "${f.ptype}".`;
  if (f.state && !/^[A-Za-z]{2}$/.test(f.state)) return "State must be a 2-letter code.";
  if (f.title && f.title.length > 200) return "Keyword is too long.";
  return null;
}

export function buildSamSearchUrl(f: SamSearchFilters, apiKey: string): URL {
  const url = new URL(SAM_GOV_SEARCH_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("postedFrom", formatSamDate(f.postedFrom));
  url.searchParams.set("postedTo", formatSamDate(f.postedTo));
  url.searchParams.set("limit", String(f.limit));
  url.searchParams.set("offset", String(f.offset ?? 0));
  if (f.ncode) url.searchParams.set("ncode", f.ncode);
  if (f.ptype) url.searchParams.set("ptype", f.ptype);
  if (f.title?.trim()) url.searchParams.set("title", f.title.trim());
  if (f.state) url.searchParams.set("state", f.state.toUpperCase());
  if (f.typeOfSetAside) url.searchParams.set("typeOfSetAside", f.typeOfSetAside);
  return url;
}

export function redactSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}

function readErrorMessage(body: unknown): { message?: string; code?: string } {
  if (!body || typeof body !== "object") return {};
  const row = body as Record<string, unknown>;
  const nested = row.error && typeof row.error === "object" ? (row.error as Record<string, unknown>) : null;
  const message =
    (nested?.message as string | undefined) ??
    (row.errorMessage as string | undefined) ??
    (row.message as string | undefined) ??
    (row.detail as string | undefined) ??
    (typeof row.error === "string" ? row.error : undefined) ??
    (row.title as string | undefined);
  const code = (nested?.code as string | undefined) ?? (row.errorCode as string | undefined) ?? (row.code as string | undefined);
  return { message: message != null ? String(message) : undefined, code: code != null ? String(code) : undefined };
}

function retryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.round((at - Date.now()) / 1000));
}

function rateRemaining(res: Response): number | undefined {
  const raw = res.headers.get("x-ratelimit-remaining");
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

async function errorFromResponse(res: Response, apiKey: string): Promise<SamError> {
  let body: unknown = null;
  let rawText = "";
  try {
    rawText = await res.text();
    body = JSON.parse(rawText);
  } catch {
    body = null;
  }
  const parsed = readErrorMessage(body);
  const detail = redactSecret(parsed.message ?? rawText.slice(0, 200), apiKey).trim();
  const code = (parsed.code ?? "").toUpperCase();

  if (res.status === 429 || code === "OVER_RATE_LIMIT") {
    return {
      kind: "rate_limited",
      status: res.status,
      retryAfterSeconds: retryAfter(res),
      message:
        "SAM.gov rate limit reached for this API key. Public keys allow a small number of requests per day; try again later." +
        (detail ? ` (${detail})` : ""),
    };
  }
  if (res.status === 401 || res.status === 403 || code.startsWith("API_KEY")) {
    return {
      kind: "unauthorized",
      status: res.status,
      message: `SAM.gov rejected the API key${detail ? `: ${detail}` : "."}`,
    };
  }
  if (res.status === 400) {
    return { kind: "bad_request", status: 400, message: `SAM.gov rejected the search${detail ? `: ${detail}` : "."}` };
  }
  return {
    kind: "upstream",
    status: res.status,
    message: `SAM.gov returned HTTP ${res.status}${detail ? `: ${detail}` : "."}`,
  };
}

export async function searchSamOpportunities(filters: SamSearchFilters, opts: FetchOpts = {}): Promise<SamSearchResult> {
  const apiKey = opts.apiKey ?? samApiKey();
  if (!apiKey) {
    return { ok: false, error: { kind: "not_configured", message: "SAM_GOV_API_KEY is not set." } };
  }
  const invalid = validateSamFilters(filters);
  if (invalid) return { ok: false, error: { kind: "invalid_filters", message: invalid } };

  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(buildSamSearchUrl(filters, apiKey).toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { kind: "network", message: `Could not reach SAM.gov: ${redactSecret(msg, apiKey)}` } };
  }

  // SAM.gov answers 404 "No Data found" for an empty search.
  if (res.status === 404) {
    return { ok: true, totalRecords: 0, opportunities: [], rateLimitRemaining: rateRemaining(res) };
  }
  if (!res.ok) return { ok: false, error: await errorFromResponse(res, apiKey) };

  let data: { totalRecords?: unknown; opportunitiesData?: unknown };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: { kind: "invalid_response", status: res.status, message: "SAM.gov response was not JSON." } };
  }
  if (!data || (data.opportunitiesData != null && !Array.isArray(data.opportunitiesData))) {
    return { ok: false, error: { kind: "invalid_response", status: res.status, message: "SAM.gov response had no opportunitiesData list." } };
  }
  const opportunities = ((data.opportunitiesData as SamOpportunity[] | undefined) ?? []).filter(
    (o): o is SamOpportunity => Boolean(o && typeof o === "object")
  );
  return {
    ok: true,
    totalRecords: Number(data.totalRecords) || opportunities.length,
    opportunities,
    rateLimitRemaining: rateRemaining(res),
  };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The search result only carries a link to the notice text. The key is appended only when that link points
 * at api.sam.gov, so it can never be sent to another host.
 */
export async function fetchSamDescription(op: SamOpportunity, opts: FetchOpts = {}): Promise<SamDescriptionResult> {
  const apiKey = opts.apiKey ?? samApiKey();
  if (!apiKey) return { status: "failed", error: { kind: "not_configured", message: "SAM_GOV_API_KEY is not set." } };
  const link = op.description?.trim();
  if (!link || link === "null") return { status: "unavailable", reason: "Notice has no description link." };

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    // Older records inline the description text instead of a link.
    const text = htmlToText(link);
    return text.length >= 20 ? { status: "fetched", text } : { status: "unavailable", reason: "Description is empty." };
  }
  if (url.protocol !== "https:" || url.hostname !== SAM_API_HOST) {
    return { status: "unavailable", reason: "Description link is not on api.sam.gov; not fetched." };
  }
  url.searchParams.set("api_key", apiKey);

  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", error: { kind: "network", message: `Could not reach SAM.gov: ${redactSecret(msg, apiKey)}` } };
  }
  if (res.status === 404) return { status: "unavailable", reason: "SAM.gov: Description Not Found." };
  if (!res.ok) return { status: "failed", error: await errorFromResponse(res, apiKey) };

  const raw = await res.text();
  let html = raw;
  try {
    const parsed = JSON.parse(raw) as { description?: unknown };
    if (parsed && typeof parsed === "object" && "description" in parsed) html = String(parsed.description ?? "");
  } catch {
    html = raw;
  }
  const text = htmlToText(html);
  if (!text || /^description not found\.?$/i.test(text)) {
    return { status: "unavailable", reason: "SAM.gov: Description Not Found." };
  }
  return { status: "fetched", text };
}
