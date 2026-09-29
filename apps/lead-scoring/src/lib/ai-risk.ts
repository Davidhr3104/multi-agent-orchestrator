import type { StoredLead } from "@helix/core";

/**
 * Deterministic risk policy for actions Helix AI runs on the operator's behalf.
 * The model never decides its own permissions: this table does. "auto" actions run
 * immediately (with an Undo); "confirm" actions wait for an explicit human click.
 */

export type RiskAssessment = { level: "auto" | "confirm"; reasons: string[] };

const BULK_LIMIT = 3;
const HIGH_SCORE = 70;

export function assessRisk(action: string, targets: StoredLead[]): RiskAssessment {
  const reasons: string[] = [];
  const confirm = () => ({ level: "confirm" as const, reasons });

  if (targets.length === 0) {
    reasons.push("No matching lead found");
    return confirm();
  }

  switch (action) {
    case "add_note":
    case "restore":
      return { level: "auto", reasons };

    case "approve_leads":
      // Approving is the human validation itself — the AI must not sign off on flagged data.
      reasons.push("Approving signs off on leads flagged for human review");
      return confirm();

    case "advance_stage":
      if (targets.some((l) => l.needsReview)) reasons.push("A lead is still awaiting human review");
      if (targets.length > BULK_LIMIT) reasons.push(`Bulk change (${targets.length} leads)`);
      if (targets.some((l) => l.pipelineStage === "lost")) reasons.push("A lead is archived");
      break;

    case "archive_leads":
      if (targets.length > BULK_LIMIT) reasons.push(`Bulk archive (${targets.length} leads)`);
      if (targets.some((l) => l.score >= HIGH_SCORE)) reasons.push("Includes a high-score lead");
      if (targets.some((l) => l.needsReview)) reasons.push("A lead is still awaiting human review");
      if (targets.some((l) => l.crmStatus && l.crmStatus !== "not_sent")) reasons.push("A lead is already synced to the CRM");
      break;

    default:
      reasons.push(`Unrecognized action "${action}"`);
  }

  return reasons.length ? confirm() : { level: "auto", reasons };
}
