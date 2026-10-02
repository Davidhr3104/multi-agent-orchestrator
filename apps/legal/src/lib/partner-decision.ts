import type { PartnerVerdict, StoredRfp } from "@helix/core";
import { modelForMethod, traceSuffix } from "@/lib/audit-trace";
import { patchRfp, recordAudit } from "@/lib/store";

export const PARTNER_VERDICTS: PartnerVerdict[] = ["GO", "CONDITIONAL", "NO-GO"];

export type PartnerDecisionInput = {
  verdict: PartnerVerdict;
  coiCleared?: boolean;
  bidAmount?: string;
  notes?: string;
};

/** One implementation of "record the partner's Go/No-Go", shared by the review button route and Helix AI. */
export async function recordPartnerDecision(id: string, input: PartnerDecisionInput, actor: string): Promise<StoredRfp | null> {
  const now = new Date().toISOString();
  const rfp = await patchRfp(id, {
    needsReview: false,
    partnerDecision: {
      verdict: input.verdict,
      coiCleared: Boolean(input.coiCleared),
      bidAmount: input.bidAmount?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      decidedBy: actor,
      decidedAt: now,
      outcome: input.verdict === "NO-GO" ? "no_bid" : "pending",
      outcomeAt: now,
    },
  });
  if (!rfp) return null;
  const before = rfp.matchScore;
  await recordAudit(
    actor,
    "partner",
    [
      `${rfp.title}: ${input.verdict}${input.coiCleared ? " · COI cleared" : ""}`,
      traceSuffix({
        model: modelForMethod(rfp.method),
        prompt: "partner-verdict-v1",
        match: `${before}`,
        approval: `${input.verdict} by ${actor}`,
      }),
    ].join("\n")
  );
  return rfp;
}
