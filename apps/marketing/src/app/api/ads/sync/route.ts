import { parseMarketingWindow, windowBounds } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { ingestSpend } from "@/lib/store";
import { fetchMetaCampaignSpend, isMetaAdsReadConfigured } from "@/lib/meta-ads";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    metaConfigured: isMetaAdsReadConfigured(),
    googleConfigured: false,
    writesEnabled: isMetaAdsReadConfigured(),
    note: "Sync is Insights read-only. HITL pause/scale writes to Meta when campaign_id is numeric and token has ads_management.",
  });
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  if (!isMetaAdsReadConfigured()) {
    return Response.json(
      {
        error:
          "Meta Ads read needs META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Settings. Paste keys there — no fake pull.",
      },
      { status: 409 }
    );
  }

  let windowRaw: string | null = null;
  try {
    const body = (await req.json()) as { window?: string };
    windowRaw = body.window ?? null;
  } catch {
    windowRaw = null;
  }

  const window = parseMarketingWindow(windowRaw);
  const { from, to } = windowBounds(window);

  try {
    const { rows, accountId } = await fetchMetaCampaignSpend({ since: from, until: to });
    if (rows.length === 0) {
      return Response.json({
        imported: 0,
        accountId,
        from,
        to,
        message: "Meta returned 0 insight rows for this window.",
      });
    }
    const snap = await ingestSpend(rows);
    return Response.json({
      imported: rows.length,
      accountId,
      from,
      to,
      campaigns: snap.campaigns.length,
      unmatchedCount: new Set(snap.unmatched.map((u) => u.campaignId)).size,
      writesEnabled: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
