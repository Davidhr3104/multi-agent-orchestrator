import { getSecret, type SpendRowInput } from "@helix/core";

/**
 * TikTok Ads spend reader (read-only) on the Business API reporting endpoint.
 * Nothing in this module writes to TikTok.
 */

const REPORT_URL = "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/";
/** TikTok rejects day-level BASIC reports spanning more than 30 days. */
const MAX_RANGE_DAYS = 30;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

type FetchLike = typeof fetch;

export const TIKTOK_ADS_ENV = {
  accessToken: "TIKTOK_ADS_ACCESS_TOKEN",
  advertiserId: "TIKTOK_ADS_ADVERTISER_ID",
} as const;

export function missingTikTokAdsEnv(): string[] {
  return Object.values(TIKTOK_ADS_ENV).filter((name) => !getSecret(name));
}

export function isTikTokAdsConfigured(): boolean {
  return missingTikTokAdsEnv().length === 0;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Splits [since, until] into consecutive ranges of at most 30 days. */
export function splitDateRange(since: string, until: string, maxDays = MAX_RANGE_DAYS): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  let start = since;
  while (start <= until) {
    const capped = addDays(start, maxDays - 1);
    const end = capped < until ? capped : until;
    out.push({ start, end });
    start = addDays(end, 1);
  }
  return out;
}

type TikTokReportRow = {
  dimensions?: { campaign_id?: string | number; stat_time_day?: string };
  metrics?: {
    campaign_name?: string;
    spend?: string | number;
    clicks?: string | number;
    impressions?: string | number;
    conversion?: string | number;
  };
};

type TikTokResponse = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: { list?: TikTokReportRow[]; page_info?: { page?: number; total_page?: number } };
};

const num = (v: string | number | undefined): number | undefined => {
  if (v === undefined || v === null || v === "" || v === "-") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function mapTikTokRows(list: TikTokReportRow[] | undefined): SpendRowInput[] {
  const rows: SpendRowInput[] = [];
  for (const r of list ?? []) {
    const campaignId = r.dimensions?.campaign_id != null ? String(r.dimensions.campaign_id).trim() : "";
    if (!campaignId) continue;
    const spend = num(r.metrics?.spend) ?? 0;
    if (spend < 0) continue;
    const conversions = num(r.metrics?.conversion);
    rows.push({
      campaignId,
      name: r.metrics?.campaign_name?.trim() || campaignId,
      platform: "tiktok",
      spend: Math.round(spend * 100) / 100,
      impressions: num(r.metrics?.impressions),
      clicks: num(r.metrics?.clicks),
      formLeads: conversions === undefined ? undefined : Math.round(conversions),
      occurredAt: r.dimensions?.stat_time_day?.slice(0, 10),
    });
  }
  return rows;
}

async function fetchPage(
  range: { start: string; end: string },
  page: number,
  fetchImpl: FetchLike
): Promise<TikTokResponse["data"]> {
  const params = new URLSearchParams({
    advertiser_id: getSecret(TIKTOK_ADS_ENV.advertiserId),
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
    metrics: JSON.stringify(["campaign_name", "spend", "clicks", "impressions", "conversion"]),
    start_date: range.start,
    end_date: range.end,
    page: String(page),
    page_size: String(PAGE_SIZE),
  });
  const res = await fetchImpl(`${REPORT_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Access-Token": getSecret(TIKTOK_ADS_ENV.accessToken) },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as TikTokResponse;
  // TikTok answers HTTP 200 with a non-zero `code` for auth and permission errors.
  if (!res.ok || body.code !== 0) {
    const code = body.code !== undefined ? ` (code ${body.code})` : "";
    throw new Error(`TikTok Ads read failed: ${body.message || `HTTP ${res.status}`}${code}`);
  }
  return body.data;
}

export async function fetchTikTokCampaignSpend(
  opts: { since: string; until: string },
  fetchImpl: FetchLike = fetch
): Promise<{ rows: SpendRowInput[]; accountId: string }> {
  const missing = missingTikTokAdsEnv();
  if (missing.length) throw new Error(`TikTok Ads read needs ${missing.join(", ")}.`);

  const rows: SpendRowInput[] = [];
  for (const range of splitDateRange(opts.since, opts.until)) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data = await fetchPage(range, page, fetchImpl);
      rows.push(...mapTikTokRows(data?.list));
      const totalPages = data?.page_info?.total_page ?? 1;
      if (page >= totalPages) break;
    }
  }
  return { rows, accountId: getSecret(TIKTOK_ADS_ENV.advertiserId) };
}
