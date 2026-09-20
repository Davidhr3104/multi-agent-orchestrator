import { getLead, patchLead } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { score?: number } = {};
  try {
    body = (await req.json()) as { score?: number };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(body.score))));
  if (!Number.isFinite(score)) return Response.json({ error: "score required" }, { status: 400 });
  const tier = score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";
  return withOrgScope(async (orgId) => {
    const current = await getLead(id, orgId);
    if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });
    const lead = await patchLead(
      id,
      {
        score,
        tier,
        scoreHistory: [
          ...(current.scoreHistory ?? []),
          { at: new Date().toISOString(), score, tier, reason: "Manual score edit" },
        ],
      },
      orgId
    );
    return Response.json({ lead: lead ?? current });
  });
}
