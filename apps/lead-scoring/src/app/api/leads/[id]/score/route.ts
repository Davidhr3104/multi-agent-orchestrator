import { getLead, patchLead } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const current = await getLead(id);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });
  let body: { score?: number } = {};
  try {
    body = (await req.json()) as { score?: number };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(body.score))));
  if (!Number.isFinite(score)) return Response.json({ error: "score required" }, { status: 400 });
  const tier = score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";
  const lead = await patchLead(id, {
    score,
    tier,
    scoreHistory: [
      ...(current.scoreHistory ?? []),
      { at: new Date().toISOString(), score, tier, reason: "Manual score edit" },
    ],
  });
  return Response.json({ lead: lead ?? current });
}
