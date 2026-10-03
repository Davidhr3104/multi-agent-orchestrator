import { getSecret, type SpendRowInput } from "@helix/core";

/**
 * Google Ads spend reader (read-only). Exchanges the OAuth refresh token for an access token, then
 * runs one GAQL query through googleAds:searchStream. Nothing in this module writes to Google Ads.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_API_VERSION = "v22";

type FetchLike = typeof fetch;

export const GOOGLE_ADS_ENV = {
  developerToken: "GOOGLE_ADS_DEVELOPER_TOKEN",
  clientId: "GOOGLE_ADS_CLIENT_ID",
  clientSecret: "GOOGLE_ADS_CLIENT_SECRET",
  refreshToken: "GOOGLE_ADS_REFRESH_TOKEN",
  customerId: "GOOGLE_ADS_CUSTOMER_ID",
  loginCustomerId: "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
  apiVersion: "GOOGLE_ADS_API_VERSION",
} as const;

const REQUIRED = [
  GOOGLE_ADS_ENV.developerToken,
  GOOGLE_ADS_ENV.clientId,
  GOOGLE_ADS_ENV.clientSecret,
  GOOGLE_ADS_ENV.refreshToken,
  GOOGLE_ADS_ENV.customerId,
];

export function missingGoogleAdsEnv(): string[] {
  return REQUIRED.filter((name) => !getSecret(name));
}

export function isGoogleAdsConfigured(): boolean {
  return missingGoogleAdsEnv().length === 0;
}

/** "123-456-7890" → "1234567890". */
export function normalizeCustomerId(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function buildCampaignSpendQuery(since: string, until: string): string {
  if (!DAY.test(since) || !DAY.test(until)) throw new Error("Google Ads dates must be YYYY-MM-DD.");
  return [
    "SELECT campaign.id, campaign.name, segments.date,",
    "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${since}' AND '${until}'`,
  ].join(" ");
}

type GoogleApiError = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { errors?: { message?: string; errorCode?: Record<string, string> }[] }[];
  };
};

function googleErrorMessage(body: unknown, status: number): string {
  const first = (Array.isArray(body) ? body[0] : body) as GoogleApiError | undefined;
  const err = first?.error;
  const detail = err?.details?.flatMap((d) => d.errors ?? [])[0];
  const code = detail?.errorCode ? Object.values(detail.errorCode)[0] : err?.status;
  const message = detail?.message || err?.message || `HTTP ${status}`;
  return code ? `${message} (${code})` : message;
}

export async function exchangeGoogleRefreshToken(fetchImpl: FetchLike = fetch): Promise<string> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getSecret(GOOGLE_ADS_ENV.clientId),
      client_secret: getSecret(GOOGLE_ADS_ENV.clientSecret),
      refresh_token: getSecret(GOOGLE_ADS_ENV.refreshToken),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    const why = body.error_description || body.error || `HTTP ${res.status}`;
    throw new Error(`Google OAuth refresh failed: ${why}`);
  }
  return body.access_token;
}

type SearchStreamRow = {
  campaign?: { id?: string | number; name?: string };
  segments?: { date?: string };
  metrics?: {
    costMicros?: string | number;
    clicks?: string | number;
    impressions?: string | number;
    conversions?: string | number;
  };
};

const num = (v: string | number | undefined): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** searchStream returns an array of batches, each with its own `results`. */
export function mapGoogleAdsRows(batches: unknown): SpendRowInput[] {
  const list = Array.isArray(batches) ? batches : [batches];
  const rows: SpendRowInput[] = [];
  for (const batch of list) {
    const results = (batch as { results?: SearchStreamRow[] } | null)?.results ?? [];
    for (const r of results) {
      const campaignId = r.campaign?.id != null ? String(r.campaign.id).trim() : "";
      if (!campaignId) continue;
      const micros = num(r.metrics?.costMicros) ?? 0;
      const spend = Math.round(micros / 10_000) / 100;
      if (spend < 0) continue;
      const conversions = num(r.metrics?.conversions);
      rows.push({
        campaignId,
        name: r.campaign?.name?.trim() || campaignId,
        platform: "google",
        spend,
        impressions: num(r.metrics?.impressions),
        clicks: num(r.metrics?.clicks),
        formLeads: conversions === undefined ? undefined : Math.round(conversions),
        occurredAt: r.segments?.date,
      });
    }
  }
  return rows;
}

/** Campaign spend/clicks/conversions by day. Throws with Google's own error text on any failure. */
export async function fetchGoogleAdsCampaignSpend(
  opts: { since: string; until: string },
  fetchImpl: FetchLike = fetch
): Promise<{ rows: SpendRowInput[]; accountId: string }> {
  const missing = missingGoogleAdsEnv();
  if (missing.length) throw new Error(`Google Ads read needs ${missing.join(", ")}.`);

  const customerId = normalizeCustomerId(getSecret(GOOGLE_ADS_ENV.customerId));
  if (!customerId) throw new Error("GOOGLE_ADS_CUSTOMER_ID must contain the 10-digit customer id.");
  const loginCustomerId = normalizeCustomerId(getSecret(GOOGLE_ADS_ENV.loginCustomerId));
  const version = getSecret(GOOGLE_ADS_ENV.apiVersion) || DEFAULT_API_VERSION;

  const accessToken = await exchangeGoogleRefreshToken(fetchImpl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": getSecret(GOOGLE_ADS_ENV.developerToken),
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetchImpl(
    `https://googleads.googleapis.com/${version}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query: buildCampaignSpendQuery(opts.since, opts.until) }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  const body = (await res.json().catch(() => null)) as unknown;
  const embeddedError = Array.isArray(body) && body.some((b) => (b as GoogleApiError)?.error);
  if (!res.ok || embeddedError || (body && !Array.isArray(body) && (body as GoogleApiError).error)) {
    throw new Error(`Google Ads read failed: ${googleErrorMessage(body, res.status)}`);
  }
  return { rows: mapGoogleAdsRows(body ?? []), accountId: customerId };
}
