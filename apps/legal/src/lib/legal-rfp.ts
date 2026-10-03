import type { PartnerVerdict, StoredRfp } from "@helix/core";
import type { AiUsageEntry } from "@/lib/ai-cost";
import type { CoiVerdict } from "@/lib/conflict-types";

export type SamRfpSource = {
  kind: "sam.gov";
  noticeId: string;
  solicitationNumber?: string;
  /** `uiLink` as returned by SAM.gov. */
  uiLink: string;
  /** Public notice page, readable without a SAM.gov login. */
  publicUrl: string;
  agency: string;
  postedDate: string;
  responseDeadline?: string;
  naics?: string;
  setAside?: string;
  noticeType?: string;
  placeOfPerformance?: string;
  resourceLinks: string[];
  descriptionStatus: "fetched" | "unavailable" | "failed" | "not_fetched";
  descriptionNote?: string;
  importedAt: string;
  importedVia: "manual" | "cron";
};

export type ExtractionMeta = {
  engine: "claude" | "heuristic";
  prompt: string;
  at: string;
  note: string;
  verifiedFields: number;
  totalFields: number;
};

export type CitedPoint = {
  point: string;
  quote: string;
  verified: boolean;
  spanStart: number;
  spanEnd: number;
};

/** A recommendation only. The partner's decision lives in `partnerDecision` and is recorded by a human. */
export type GoNoGoProposal = {
  engine: "claude" | "heuristic";
  recommendation: PartnerVerdict;
  confidence: number;
  rationale: string;
  reasons: CitedPoint[];
  risks: CitedPoint[];
  conditions: string[];
  coiVerdict?: CoiVerdict;
  coiEngine?: "claude" | "heuristic";
  noBidRuleHit?: string;
  generatedAt: string;
  prompt: string;
  note?: string;
};

export type LegalRfpMeta = {
  source?: SamRfpSource;
  aiUsage?: AiUsageEntry[];
  extraction?: ExtractionMeta;
  goNoGoProposal?: GoNoGoProposal;
};

export type LegalRfp = StoredRfp & LegalRfpMeta;

export function pickRfpMeta(rfp: LegalRfp): LegalRfpMeta | null {
  const meta: LegalRfpMeta = {};
  if (rfp.source) meta.source = rfp.source;
  if (rfp.aiUsage?.length) meta.aiUsage = rfp.aiUsage;
  if (rfp.extraction) meta.extraction = rfp.extraction;
  if (rfp.goNoGoProposal) meta.goNoGoProposal = rfp.goNoGoProposal;
  return Object.keys(meta).length ? meta : null;
}

export function isSamRfp(rfp: StoredRfp): rfp is LegalRfp & { source: SamRfpSource } {
  return (rfp as LegalRfp).source?.kind === "sam.gov";
}
