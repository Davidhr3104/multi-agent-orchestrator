import { getLead, patchLead } from "@/lib/store";
import { finishLeadIngest } from "@/lib/finish-ingest";
import { withOrgScope } from "@/lib/org-auth";
import { requireOperator } from "@helix/core/operator";
import type { LeadEmit, LeadIngestInput } from "@helix/core";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { score?: number; mode?: "pipeline" | "manual"; rescore?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const wantsPipeline = body.mode === "pipeline" || body.rescore === true;

  return withOrgScope(async (orgId) => {
    const current = await getLead(id, orgId);
    if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

    if (wantsPipeline) {
      const input: LeadIngestInput = {
        name: current.name,
        email: current.email,
        phone: current.phone,
        company: current.company,
        source: current.source || "helix-rescore",
        message: current.message,
        campaignId: current.campaignId,
        trade: current.trade,
        zip: current.zip,
        budget: current.budget,
      };
      const emit: LeadEmit = () => undefined;
      try {
        const lead = await finishLeadIngest(input, emit, orgId, { heuristicOnly: Boolean(requireOperator(req)) });
        // Mark the most recent scoreHistory entry as a manual rescore, not a fresh pipeline run,
        // so the audit view can distinguish operator-triggered rescoring from real ingestion.
        if (lead.scoreHistory && lead.scoreHistory.length > 0) {
          const history = [...lead.scoreHistory];
          const last = history[history.length - 1];
          history[history.length - 1] = { ...last, reason: `Manual rescore — ${last.reason}` };
          await patchLead(lead.id, { scoreHistory: history }, orgId);
          lead.scoreHistory = history;
        }
        return Response.json({ lead, mode: "pipeline" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: message }, { status: 502 });
      }
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(body.score))));
    if (!Number.isFinite(score)) {
      return Response.json(
        { error: "score required (number) or mode:\"pipeline\" to re-run engine" },
        { status: 400 }
      );
    }
    const tier = score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";
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
    return Response.json({ lead: lead ?? current, mode: "manual" });
  });
}
