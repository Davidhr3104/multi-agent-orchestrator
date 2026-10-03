import { getSnapshot, storeKind } from "@/lib/store";
import { isMetaAdsReadConfigured } from "@/lib/meta-ads";
import { getAllSourceStatus } from "@/lib/ad-sources";

export const runtime = "nodejs";

export async function GET() {
  const snap = await getSnapshot("30d");
  const meta = isMetaAdsReadConfigured();
  const sources = getAllSourceStatus();
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
    store: storeKind(),
    unmatched: new Set(snap.unmatched.map((u) => u.campaignId)).size,
    metaWrites: meta,
  });
}
