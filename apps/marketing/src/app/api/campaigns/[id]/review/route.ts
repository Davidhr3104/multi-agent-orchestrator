import { decideCampaign } from "@/lib/campaign-decision";
import { operatorActor, requireOperator } from "@helix/core/operator";

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

  const result = await decideCampaign(id, body.action, body.note, operatorActor(req), body.writeAds !== false);
  if (!result) return Response.json({ error: "Campaign not found" }, { status: 404 });
  return Response.json(result);
}
