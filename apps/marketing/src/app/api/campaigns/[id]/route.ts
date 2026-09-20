import { getSnapshot, parseMarketingWindow } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const snap = await getSnapshot(parseMarketingWindow(url.searchParams.get("window")));
  const campaignId = id.startsWith("camp-") ? id.slice(5) : id;
  const campaign = snap.campaigns.find((c) => c.id === id || c.campaignId === campaignId);
  if (!campaign) {
    const unmatched = snap.unmatched.filter((u) => u.campaignId === campaignId);
    if (unmatched.length === 0) return Response.json({ error: "Campaign not found" }, { status: 404 });
    return Response.json({
      unmatched,
      window: snap.window,
      from: snap.from,
      to: snap.to,
    });
  }
  const leads = snap.leads.filter((l) => l.campaignId === campaign.campaignId);
  return Response.json({
    campaign,
    leads,
    window: snap.window,
    from: snap.from,
    to: snap.to,
  });
}
