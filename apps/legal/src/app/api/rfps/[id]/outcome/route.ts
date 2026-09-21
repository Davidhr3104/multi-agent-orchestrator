import { getRfp, patchRfp, recordAudit } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";
import type { MatterOutcome } from "@helix/core";

export const runtime = "nodejs";

const OUTCOMES: MatterOutcome[] = ["pending", "won", "lost", "withdrawn", "no_bid"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: {
    outcome?: string;
    outcomeNotes?: string;
    wonAmount?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const outcome = body.outcome as MatterOutcome | undefined;
  if (!outcome || !OUTCOMES.includes(outcome)) {
    return Response.json(
      { error: "outcome must be pending, won, lost, withdrawn, or no_bid." },
      { status: 400 }
    );
  }

  const existing = await getRfp(id);
  if (!existing) return Response.json({ error: "RFP not found" }, { status: 404 });
  if (!existing.partnerDecision) {
    return Response.json({ error: "Partner verdict required before recording outcome." }, { status: 400 });
  }

  const actor = operatorActor(req);
  const rfp = await patchRfp(id, {
    partnerDecision: {
      ...existing.partnerDecision,
      outcome,
      outcomeAt: new Date().toISOString(),
      outcomeNotes: body.outcomeNotes?.trim() || existing.partnerDecision.outcomeNotes,
      wonAmount:
        outcome === "won"
          ? body.wonAmount?.trim() || existing.partnerDecision.wonAmount || existing.partnerDecision.bidAmount
          : existing.partnerDecision.wonAmount,
    },
  });
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  await recordAudit(actor, "outcome", `${rfp.title}: ${outcome}`);
  return Response.json({ rfp });
}
