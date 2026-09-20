import { reviewCampaign } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { action?: string; note?: string } = {};
  try {
    body = (await req.json()) as { action?: string; note?: string };
  } catch {
    body = {};
  }
  if (body.action !== "pause" && body.action !== "scale" && body.action !== "keep") {
    return Response.json({ error: "action must be pause, scale, or keep." }, { status: 400 });
  }
  const campaign = await reviewCampaign(id, body.action, body.note, operatorActor(req));
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
  return Response.json({ campaign });
}
