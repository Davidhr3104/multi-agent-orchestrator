import { decideCampaign } from "@/lib/campaign-decision";
import { deskWriteDenied, mayWriteAds } from "@/lib/ai-desk";
import { operatorActor } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = deskWriteDenied(req);
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

  const wantsAds = body.writeAds !== false && body.action !== "keep";
  const writeAds = wantsAds && mayWriteAds(req);
  const result = await decideCampaign(id, body.action, body.note, operatorActor(req), writeAds);
  if (!result) return Response.json({ error: "Campaign not found" }, { status: 404 });
  if (wantsAds && !writeAds) {
    result.adsWrite = {
      ...result.adsWrite,
      detail: "Saved on the Helix desk only — nothing was sent to the ad platform. Ads Manager writes need operator unlock.",
    };
  }
  return Response.json(result);
}
