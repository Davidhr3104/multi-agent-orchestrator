import type { CampaignAction, StoredCampaign } from "@helix/core";
import { applyMetaCampaignAction, isMetaAdsWriteConfigured, type MetaWriteResult } from "@/lib/meta-ads";
import { reviewCampaign } from "@/lib/store";

export type CampaignDecisionResult = {
  campaign: StoredCampaign;
  adsWrite: MetaWriteResult;
  metaWriteConfigured: boolean;
};

/**
 * One implementation of "keep / pause / scale a campaign", shared by the HITL button route and Helix AI.
 * The decision is always recorded locally; pause and scale also try to write back to Meta when it is
 * configured, and the result says plainly whether that write happened.
 */
export async function decideCampaign(
  id: string,
  action: CampaignAction,
  note: string | undefined,
  actor: string | undefined,
  writeAds = true
): Promise<CampaignDecisionResult | null> {
  const campaign = await reviewCampaign(id, action, note, actor);
  if (!campaign) return null;

  const wantWrite = writeAds && (action === "pause" || action === "scale");
  const base = { attempted: false, platform: "meta" as const, action, campaignId: campaign.campaignId };

  let adsWrite: MetaWriteResult;
  if (wantWrite && campaign.platform === "meta") {
    adsWrite = await applyMetaCampaignAction(campaign.campaignId, action as "pause" | "scale");
  } else if (wantWrite) {
    adsWrite = { ...base, ok: false, detail: `Platform is ${campaign.platform} — Meta write skipped. Local decision saved.` };
  } else if (action === "keep") {
    adsWrite = { ...base, ok: true, detail: "Keep is local-only by design." };
  } else {
    adsWrite = {
      ...base,
      ok: false,
      detail: isMetaAdsWriteConfigured() ? "Ads write disabled for this request (writeAds:false)." : "Meta keys not configured — local only.",
    };
  }
  return { campaign, adsWrite, metaWriteConfigured: isMetaAdsWriteConfigured() };
}
