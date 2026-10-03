import type { StoredLead } from "@helix/core";

export type TriageReason = {
  reason: string;
  /** Verbatim excerpt of the lead's own text that supports the reason. */
  quote: string;
  /** True only when `quote` was found in the lead's text; Claude's claim alone is not enough. */
  verified: boolean;
};

export type AiTriage = {
  engine: "claude" | "heuristic";
  model?: string;
  classification: StoredLead["classification"];
  score: number;
  confidence: number;
  reasons: TriageReason[];
  triagedAt: string;
  /** Why the heuristic ran instead of Claude (no key, API error, invalid JSON). */
  fallbackReason?: string;
};

export type NextMoveChannel = "email" | "call" | "sms" | "linkedin" | "other";

export type NextMoveDraft = {
  status: "draft" | "approved" | "dismissed";
  action: string;
  channel: NextMoveChannel;
  subject?: string;
  message: string;
  rationale: string;
  model: string;
  createdAt: string;
  createdBy: "operator" | "cron";
  decidedBy?: string;
  decidedAt?: string;
};

export type CrmTarget = "ghl" | "hubspot";

/** A queued suggestion to push a lead to the CRM. Only a human approval performs the push. */
export type CrmProposal = {
  status: "pending_approval";
  target: CrmTarget | null;
  queuedAt: string;
  queuedBy: "cron";
  reason: string;
};

export type LeadAiExtras = {
  aiTriage?: AiTriage;
  nextMove?: NextMoveDraft;
  crmProposal?: CrmProposal;
  hubspotContactId?: string;
  hubspotSyncedAt?: string;
  hubspotError?: string;
};

export type HelixLead = StoredLead & LeadAiExtras;

export function isHotLead(lead: Pick<StoredLead, "classification" | "tier">): boolean {
  return lead.classification === "lead" && lead.tier === "hot";
}
