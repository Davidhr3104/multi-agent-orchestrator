import { parseMarketingWindow, windowBounds } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { AD_SOURCES, getAllSourceStatus, isSourceConfigured, syncAdSource, type AdSource } from "@/lib/ad-sources";
import { isMetaAdsReadConfigured } from "@/lib/meta-ads";
import { getSnapshot, upsertSourceSpend } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const sources = getAllSourceStatus();
  return Response.json({
    metaConfigured: sources.meta.configured,
    googleConfigured: sources.google.configured,
    tiktokConfigured: sources.tiktok.configured,
    sources,
    writesEnabled: isMetaAdsReadConfigured(),
    note: "Sync is read-only on every platform. Pause/scale writes only to Meta, only after a person confirms, and only when the campaign_id is numeric and the token has ads_management. Google Ads and TikTok are never written to.",
  });
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  let windowRaw: string | null = null;
  let sourceRaw: string | undefined;
  try {
    const body = (await req.json()) as { window?: string; source?: string };
    windowRaw = body.window ?? null;
    sourceRaw = body.source;
  } catch {
    windowRaw = null;
  }

  const requested: AdSource[] =
    sourceRaw && sourceRaw !== "all"
      ? AD_SOURCES.filter((s) => s === sourceRaw)
      : AD_SOURCES.filter((s) => isSourceConfigured(s));
  if (sourceRaw && sourceRaw !== "all" && requested.length === 0) {
    return Response.json({ error: "source must be meta, google, tiktok or all." }, { status: 400 });
  }
  if (requested.length === 0 || requested.every((s) => !isSourceConfigured(s))) {
    return Response.json(
      {
        error:
          "No ad platform is configured for this request. Add Meta, Google Ads or TikTok Ads credentials — no fake pull.",
        sources: getAllSourceStatus(),
      },
      { status: 409 }
    );
  }

  const window = parseMarketingWindow(windowRaw);
  const { from, to } = windowBounds(window);
  const results = [];
  for (const source of requested) {
    results.push(await syncAdSource(source, { since: from, until: to }, upsertSourceSpend));
  }
  const snap = await getSnapshot(window);
  const imported = results.reduce((s, r) => s + r.imported, 0);
  const anyOk = results.some((r) => r.ok);
  return Response.json(
    {
      imported,
      from,
      to,
      results,
      campaigns: snap.campaigns.length,
      unmatchedCount: new Set(snap.unmatched.map((u) => u.campaignId)).size,
      sources: getAllSourceStatus(),
      error: anyOk ? undefined : results.map((r) => r.error).filter(Boolean).join(" · "),
    },
    { status: anyOk ? 200 : 502 }
  );
}
