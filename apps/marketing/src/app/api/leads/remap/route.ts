import { listRemaps, remapCampaign } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ remaps: await listRemaps() });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const spendCampaignId = String((body as { spendCampaignId?: unknown }).spendCampaignId ?? "").trim();
  const leadCampaignId = String((body as { leadCampaignId?: unknown }).leadCampaignId ?? "").trim();
  if (!spendCampaignId || !leadCampaignId) {
    return Response.json({ error: "spendCampaignId and leadCampaignId required" }, { status: 400 });
  }
  const snap = await remapCampaign(spendCampaignId, leadCampaignId);
  return Response.json({ remaps: await listRemaps(), unmatched: snap.unmatched.length });
}
