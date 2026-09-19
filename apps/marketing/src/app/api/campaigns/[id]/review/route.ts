import { reviewCampaign } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const campaign = reviewCampaign(id, body.action, body.note);
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
  return Response.json({ campaign });
}
