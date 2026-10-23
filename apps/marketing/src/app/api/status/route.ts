import { settingsPrivileged } from "@helix/core";
import { getSnapshot, storeKind } from "@/lib/store";
import { isMetaAdsReadConfigured } from "@/lib/meta-ads";
import { getAllSourceStatus, type SourceStatus } from "@/lib/ad-sources";

export const runtime = "nodejs";

function hiddenSource(source: SourceStatus["source"]): SourceStatus {
  return {
    source,
    configured: false,
    verified: false,
    missing: [],
    lastAttemptAt: null,
    lastOkAt: null,
    lastError: null,
    lastRows: null,
  };
}

export async function GET(req: Request) {
  const snap = await getSnapshot("30d");
  const privileged = settingsPrivileged(req);
  const sources = privileged
    ? getAllSourceStatus()
    : { meta: hiddenSource("meta"), google: hiddenSource("google"), tiktok: hiddenSource("tiktok") };
  const meta = privileged && isMetaAdsReadConfigured();
  return Response.json({
    meta,
    // Google Ads / TikTok count as connected only after a real read succeeded.
    google: sources.google.verified,
    tiktok: sources.tiktok.verified,
    googleConfigured: sources.google.configured,
    tiktokConfigured: sources.tiktok.configured,
    metaVerified: sources.meta.verified,
    sources,
    csv: true,
    store: privileged ? storeKind() : "memory",
    unmatched: new Set(snap.unmatched.map((u) => u.campaignId)).size,
    metaWrites: meta,
  });
}
