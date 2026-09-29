import { recordPartnerDecision, PARTNER_VERDICTS } from "@/lib/partner-decision";
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
  if (!verdict || !PARTNER_VERDICTS.includes(verdict)) {
    return Response.json({ error: "verdict must be GO, CONDITIONAL, or NO-GO." }, { status: 400 });
  }
  const rfp = await recordPartnerDecision(
    id,
    { verdict, coiCleared: body.coiCleared, bidAmount: body.bidAmount, notes: body.notes },
    operatorActor(req)
  );
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  return Response.json({ rfp });
}
