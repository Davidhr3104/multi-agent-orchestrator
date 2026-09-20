import { getSnapshot, storeKind } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const snap = await getSnapshot("30d");
  return Response.json({
    meta: false,
    google: false,
    csv: true,
    store: storeKind(),
    unmatched: new Set(snap.unmatched.map((u) => u.campaignId)).size,
  });
}
