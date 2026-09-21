import { getSnapshot, storeKind } from "@/lib/store";
import { isMetaAdsReadConfigured } from "@/lib/meta-ads";

export const runtime = "nodejs";

export async function GET() {
  const snap = await getSnapshot("30d");
  const meta = isMetaAdsReadConfigured();
  return Response.json({
    meta,
    google: false,
    csv: true,
    store: storeKind(),
    unmatched: new Set(snap.unmatched.map((u) => u.campaignId)).size,
    metaWrites: meta,
  });
}
