import { patchRfp, recordAudit } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";
import type { PartnerVerdict } from "@helix/core";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: {
    verdict?: string;
    coiCleared?: boolean;
    bidAmount?: string;
    notes?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const verdict = body.verdict as PartnerVerdict | undefined;
  if (verdict !== "GO" && verdict !== "CONDITIONAL" && verdict !== "NO-GO") {
    return Response.json({ error: "verdict must be GO, CONDITIONAL, or NO-GO." }, { status: 400 });
  }
  const actor = operatorActor(req);
  const now = new Date().toISOString();
  const rfp = await patchRfp(id, {
    needsReview: false,
    partnerDecision: {
      verdict,
      coiCleared: Boolean(body.coiCleared),
      bidAmount: body.bidAmount?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      decidedBy: actor,
      decidedAt: now,
      outcome: verdict === "NO-GO" ? "no_bid" : "pending",
      outcomeAt: now,
    },
  });
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  await recordAudit(actor, "partner", `${rfp.title}: ${verdict}${body.coiCleared ? " · COI cleared" : ""}`);
  return Response.json({ rfp });
}
