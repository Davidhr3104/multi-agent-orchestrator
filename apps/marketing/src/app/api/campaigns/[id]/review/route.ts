import { reviewCampaign } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { applyMetaCampaignAction, isMetaAdsWriteConfigured } from "@/lib/meta-ads";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { action?: string; note?: string; writeAds?: boolean } = {};
  try {
    body = (await req.json()) as { action?: string; note?: string; writeAds?: boolean };
  } catch {
    body = {};
  }
  if (body.action !== "pause" && body.action !== "scale" && body.action !== "keep") {
    return Response.json({ error: "action must be pause, scale, or keep." }, { status: 400 });
  }

  const campaign = await reviewCampaign(id, body.action, body.note, operatorActor(req));
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

  const wantWrite = body.writeAds !== false && (body.action === "pause" || body.action === "scale");

  let adsWrite = null as Awaited<ReturnType<typeof applyMetaCampaignAction>> | null;
  if (wantWrite && campaign.platform === "meta") {
    adsWrite = await applyMetaCampaignAction(campaign.campaignId, body.action);
  } else if (wantWrite && campaign.platform !== "meta") {
    adsWrite = {
      attempted: false,
      ok: false,
      platform: "meta",
      action: body.action,
      campaignId: campaign.campaignId,
      detail: `Platform is ${campaign.platform} — Meta write skipped. Local decision saved.`,
    };
  } else if (body.action === "keep") {
    adsWrite = {
      attempted: false,
      ok: true,
      platform: "meta",
      action: "keep",
      campaignId: campaign.campaignId,
      detail: "Keep is local-only by design.",
    };
  } else {
    adsWrite = {
      attempted: false,
      ok: false,
      platform: "meta",
      action: body.action,
      campaignId: campaign.campaignId,
      detail: isMetaAdsWriteConfigured()
        ? "Ads write disabled for this request (writeAds:false)."
        : "Meta keys not configured — local only.",
    };
  }

  return Response.json({
    campaign,
    adsWrite,
    metaWriteConfigured: isMetaAdsWriteConfigured(),
  });
}
