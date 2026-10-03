import { NetworkError, scrub, type FetchLike, type MetaConfig } from "./config";

/** A post that exists on a real account, with the metrics the Graph API returned. Null means the API did not return that metric. */
export type RealPost = {
  network: "instagram" | "facebook";
  id: string;
  caption: string;
  mediaType: string;
  permalink: string | null;
  publishedAt: string;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  reach: number | null;
  views: number | null;
};

export type AccountSummary = {
  network: "instagram" | "facebook";
  id: string;
  name: string;
  followers: number | null;
  /** Account-level totals for the last `periodDays` days, as returned by the insights endpoint. */
  periodDays: number;
  reach: number | null;
  views: number | null;
  interactions: number | null;
};

export type NetworkRead = { ok: true; account: AccountSummary; posts: RealPost[]; warnings: string[] } | { ok: false; error: string };

export type MetaVerification = {
  ok: boolean;
  checkedAt: string;
  /** ISO time the token expires, or null when Meta reports no expiry or the call could not tell. */
  expiresAt: string | null;
  expired: boolean;
  scopes: string[];
  error?: string;
};

export const MEDIA_LIMIT = 25;
export const ACCOUNT_PERIOD_DAYS = 7;

type GraphError = { error?: { message?: string; code?: number } };

async function graphGet<T>(cfg: MetaConfig, path: string, params: Record<string, string>, token: string, fetchImpl: FetchLike): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const url = `https://graph.facebook.com/${cfg.graphVersion}/${path}${query ? `?${query}` : ""}`;
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => null)) as (T & GraphError) | null;
  if (!res.ok || !body || body.error) {
    throw new NetworkError(scrub(body?.error?.message ?? `Graph API answered ${res.status}`), res.status);
  }
  return body;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

type InsightRow = { name: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } };

/** Reads one metric from an insights payload: total_value first, otherwise the sum of the period values. */
export function insightValue(rows: InsightRow[] | undefined, name: string): number | null {
  const row = rows?.find((r) => r.name === name);
  if (!row) return null;
  const total = num(row.total_value?.value);
  if (total !== null) return total;
  const values = (row.values ?? []).map((v) => num(v.value)).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

export function mapIgMedia(m: IgMedia, insights: InsightRow[] | undefined): RealPost {
  return {
    network: "instagram",
    id: m.id,
    caption: m.caption ?? "",
    mediaType: m.media_product_type === "REELS" ? "REELS" : (m.media_type ?? "UNKNOWN"),
    permalink: m.permalink ?? null,
    publishedAt: m.timestamp ? new Date(m.timestamp).toISOString() : new Date(0).toISOString(),
    likes: num(m.like_count),
    comments: num(m.comments_count),
    saves: insightValue(insights, "saved"),
    shares: insightValue(insights, "shares"),
    reach: insightValue(insights, "reach"),
    views: insightValue(insights, "views"),
  };
}

type FbPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

export function mapFbPost(p: FbPost, insights: InsightRow[] | undefined): RealPost {
  return {
    network: "facebook",
    id: p.id,
    caption: p.message ?? "",
    mediaType: "POST",
    permalink: p.permalink_url ?? null,
    publishedAt: p.created_time ? new Date(p.created_time).toISOString() : new Date(0).toISOString(),
    likes: num(p.reactions?.summary?.total_count),
    comments: num(p.comments?.summary?.total_count),
    saves: null,
    shares: p.shares ? (num(p.shares.count) ?? 0) : 0,
    reach: insightValue(insights, "post_impressions_unique"),
    views: null,
  };
}

function periodParams(now: Date, days: number) {
  const until = Math.floor(now.getTime() / 1000);
  return { since: String(until - days * 86_400), until: String(until) };
}

/** Media metrics differ by media type, and one unsupported metric fails the whole call, so this retries with fewer. */
async function igMediaInsights(cfg: MetaConfig, id: string, fetchImpl: FetchLike): Promise<InsightRow[] | undefined> {
  for (const metric of ["reach,saved,shares,views", "reach,saved,shares", "reach"]) {
    try {
      return (await graphGet<{ data: InsightRow[] }>(cfg, `${id}/insights`, { metric }, cfg.token, fetchImpl)).data;
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function readInstagram(cfg: MetaConfig, fetchImpl: FetchLike, now = new Date()): Promise<NetworkRead> {
  if (!cfg.igUserId) return { ok: false, error: "HELIX_META_IG_USER_ID is not set." };
  try {
    const warnings: string[] = [];
    const profile = await graphGet<{ id: string; username?: string; followers_count?: number }>(cfg, cfg.igUserId, { fields: "id,username,followers_count,media_count" }, cfg.token, fetchImpl);
    const media = await graphGet<{ data: IgMedia[] }>(
      cfg,
      `${cfg.igUserId}/media`,
      { fields: "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count", limit: String(MEDIA_LIMIT) },
      cfg.token,
      fetchImpl
    );
    const posts: RealPost[] = [];
    for (const item of media.data ?? []) {
      const rows = await igMediaInsights(cfg, item.id, fetchImpl);
      if (!rows) warnings.push(`No insights for Instagram media ${item.id}.`);
      posts.push(mapIgMedia(item, rows));
    }
    let account: InsightRow[] | undefined;
    try {
      account = (
        await graphGet<{ data: InsightRow[] }>(
          cfg,
          `${cfg.igUserId}/insights`,
          { metric: "reach,views,total_interactions", period: "day", metric_type: "total_value", ...periodParams(now, ACCOUNT_PERIOD_DAYS) },
          cfg.token,
          fetchImpl
        )
      ).data;
    } catch (err) {
      warnings.push(`Instagram account insights unavailable: ${err instanceof Error ? err.message : "error"}`);
    }
    return {
      ok: true,
      warnings,
      posts,
      account: {
        network: "instagram",
        id: profile.id,
        name: profile.username ? `@${profile.username}` : profile.id,
        followers: num(profile.followers_count),
        periodDays: ACCOUNT_PERIOD_DAYS,
        reach: insightValue(account, "reach"),
        views: insightValue(account, "views"),
        interactions: insightValue(account, "total_interactions"),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrub(err.message) : "Instagram read failed." };
  }
}

export async function readFacebook(cfg: MetaConfig, fetchImpl: FetchLike, now = new Date()): Promise<NetworkRead> {
  if (!cfg.pageId) return { ok: false, error: "HELIX_META_PAGE_ID is not set." };
  try {
    const warnings: string[] = [];
    const page = await graphGet<{ id: string; name?: string; followers_count?: number; fan_count?: number }>(cfg, cfg.pageId, { fields: "id,name,followers_count,fan_count" }, cfg.pageToken, fetchImpl);
    const feed = await graphGet<{ data: FbPost[] }>(
      cfg,
      `${cfg.pageId}/posts`,
      { fields: "id,message,created_time,permalink_url,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)", limit: String(MEDIA_LIMIT) },
      cfg.pageToken,
      fetchImpl
    );
    const posts: RealPost[] = [];
    for (const item of feed.data ?? []) {
      let rows: InsightRow[] | undefined;
      try {
        rows = (await graphGet<{ data: InsightRow[] }>(cfg, `${item.id}/insights`, { metric: "post_impressions_unique" }, cfg.pageToken, fetchImpl)).data;
      } catch {
        warnings.push(`No reach for Facebook post ${item.id}.`);
      }
      posts.push(mapFbPost(item, rows));
    }
    let account: InsightRow[] | undefined;
    try {
      account = (
        await graphGet<{ data: InsightRow[] }>(
          cfg,
          `${cfg.pageId}/insights`,
          { metric: "page_impressions_unique,page_post_engagements", period: "day", ...periodParams(now, ACCOUNT_PERIOD_DAYS) },
          cfg.pageToken,
          fetchImpl
        )
      ).data;
    } catch (err) {
      warnings.push(`Facebook Page insights unavailable: ${err instanceof Error ? err.message : "error"}`);
    }
    return {
      ok: true,
      warnings,
      posts,
      account: {
        network: "facebook",
        id: page.id,
        name: page.name ?? page.id,
        followers: num(page.followers_count) ?? num(page.fan_count),
        periodDays: ACCOUNT_PERIOD_DAYS,
        reach: insightValue(account, "page_impressions_unique"),
        views: null,
        interactions: insightValue(account, "page_post_engagements"),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrub(err.message) : "Facebook read failed." };
  }
}

/** Validates the token with Meta. debug_token gives the expiry; /me is the fallback proof that the token works. */
export async function verifyMetaToken(cfg: MetaConfig, fetchImpl: FetchLike, now = new Date()): Promise<MetaVerification> {
  const checkedAt = now.toISOString();
  try {
    const debug = await graphGet<{ data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number; scopes?: string[]; error?: { message?: string } } }>(
      cfg,
      "debug_token",
      { input_token: cfg.token },
      cfg.token,
      fetchImpl
    );
    const data = debug.data ?? {};
    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null;
    const expired = Boolean(data.expires_at && data.expires_at * 1000 <= now.getTime());
    if (!data.is_valid || expired) {
      return { ok: false, checkedAt, expiresAt, expired, scopes: data.scopes ?? [], error: scrub(data.error?.message ?? (expired ? "Token expired." : "Meta says the token is not valid.")) };
    }
    return { ok: true, checkedAt, expiresAt, expired: false, scopes: data.scopes ?? [] };
  } catch {
    try {
      await graphGet<{ id: string }>(cfg, "me", { fields: "id" }, cfg.token, fetchImpl);
      return { ok: true, checkedAt, expiresAt: null, expired: false, scopes: [] };
    } catch (err) {
      return { ok: false, checkedAt, expiresAt: null, expired: false, scopes: [], error: err instanceof Error ? scrub(err.message) : "Token check failed." };
    }
  }
}
