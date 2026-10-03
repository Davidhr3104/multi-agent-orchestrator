import type { AdPlatform, SpendRowInput } from "@helix/core";
import { readJsonFile, writeJsonFile } from "@/lib/desk-files";
import { fetchGoogleAdsCampaignSpend, isGoogleAdsConfigured, missingGoogleAdsEnv } from "@/lib/google-ads";
import { fetchMetaCampaignSpend, isMetaAdsReadConfigured } from "@/lib/meta-ads";
import { fetchTikTokCampaignSpend, isTikTokAdsConfigured, missingTikTokAdsEnv } from "@/lib/tiktok-ads";

/**
 * Which ad platforms are connected, in the strict sense: credentials saved AND the last real read
 * succeeded. "configured" alone never counts as connected/live in the UI.
 */

export type AdSource = "meta" | "google" | "tiktok";
export const AD_SOURCES: AdSource[] = ["meta", "google", "tiktok"];

type SourceRecord = {
  lastAttemptAt?: string;
  lastResult?: "ok" | "error";
  lastOkAt?: string;
  lastError?: string;
  lastRows?: number;
  accountId?: string;
  /** Campaign ids seen on this platform — used to label TikTok rows, which core stores as "other". */
  campaignIds?: string[];
};

type SourcesFile = Partial<Record<AdSource, SourceRecord>>;

export type SourceStatus = {
  source: AdSource;
  configured: boolean;
  /** True only when credentials are present and the most recent real read succeeded. */
  verified: boolean;
  missing: string[];
  lastAttemptAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  lastRows: number | null;
};

const FILE = "ad-sources.json";

function state(): SourcesFile {
  const g = globalThis as { __helixMarketingSources?: SourcesFile };
  if (!g.__helixMarketingSources) g.__helixMarketingSources = readJsonFile<SourcesFile>(FILE) ?? {};
  return g.__helixMarketingSources;
}

export function resetSourceState(): void {
  (globalThis as { __helixMarketingSources?: SourcesFile }).__helixMarketingSources = {};
}

export function isSourceConfigured(source: AdSource): boolean {
  if (source === "meta") return isMetaAdsReadConfigured();
  if (source === "google") return isGoogleAdsConfigured();
  return isTikTokAdsConfigured();
}

function missingFor(source: AdSource): string[] {
  if (source === "google") return missingGoogleAdsEnv();
  if (source === "tiktok") return missingTikTokAdsEnv();
  return isMetaAdsReadConfigured() ? [] : ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"];
}

export function getSourceStatus(source: AdSource): SourceStatus {
  const rec = state()[source] ?? {};
  const configured = isSourceConfigured(source);
  return {
    source,
    configured,
    verified: configured && rec.lastResult === "ok",
    missing: missingFor(source),
    lastAttemptAt: rec.lastAttemptAt ?? null,
    lastOkAt: rec.lastOkAt ?? null,
    lastError: rec.lastResult === "error" ? (rec.lastError ?? null) : null,
    lastRows: rec.lastRows ?? null,
  };
}

export function getAllSourceStatus(): Record<AdSource, SourceStatus> {
  return {
    meta: getSourceStatus("meta"),
    google: getSourceStatus("google"),
    tiktok: getSourceStatus("tiktok"),
  };
}

function record(source: AdSource, patch: SourceRecord): void {
  const s = state();
  s[source] = { ...s[source], ...patch };
  writeJsonFile(FILE, s);
}

/** Platform label for a campaign. Older TikTok rows were stored as "other" and are found via the registry. */
export function campaignSource(campaignId: string, platform: AdPlatform): AdSource | "other" {
  if (platform === "meta" || platform === "google" || platform === "tiktok") return platform;
  return state().tiktok?.campaignIds?.includes(campaignId) ? "tiktok" : "other";
}

export const SOURCE_LABEL: Record<AdSource | "other", string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
  other: "Other / CSV",
};

type Range = { since: string; until: string };

async function readSource(source: AdSource, range: Range) {
  if (source === "meta") return fetchMetaCampaignSpend(range);
  if (source === "google") return fetchGoogleAdsCampaignSpend(range);
  return fetchTikTokCampaignSpend(range);
}

export type SyncResult = {
  source: AdSource;
  ok: boolean;
  imported: number;
  accountId?: string;
  error?: string;
  skipped?: "not_configured";
};

/**
 * Reads one platform for a date range and upserts the rows into the desk. The source becomes
 * "verified" only when the platform's API answered successfully.
 */
export async function syncAdSource(
  source: AdSource,
  range: Range,
  ingest: (source: AdSource, rows: SpendRowInput[]) => Promise<unknown>
): Promise<SyncResult> {
  if (!isSourceConfigured(source)) {
    return { source, ok: false, imported: 0, skipped: "not_configured", error: `${SOURCE_LABEL[source]} is not configured.` };
  }
  const at = new Date().toISOString();
  try {
    const { rows, accountId } = await readSource(source, range);
    if (rows.length > 0) await ingest(source, rows);
    const prevIds = state()[source]?.campaignIds ?? [];
    const ids = [...new Set([...prevIds, ...rows.map((r) => r.campaignId)])].slice(-2000);
    record(source, { lastAttemptAt: at, lastResult: "ok", lastOkAt: at, lastError: undefined, lastRows: rows.length, accountId, campaignIds: ids });
    return { source, ok: true, imported: rows.length, accountId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record(source, { lastAttemptAt: at, lastResult: "error", lastError: message.slice(0, 400) });
    return { source, ok: false, imported: 0, error: message };
  }
}
