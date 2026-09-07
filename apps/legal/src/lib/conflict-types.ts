export type FirmClientStatus = "Active" | "Inactive";
export type FirmMatterStatus = "Active" | "Closed";

export type FirmClient = {
  id: string;
  clientName: string;
  clientType: string;
  status: FirmClientStatus;
};

export type FirmMatter = {
  id: string;
  clientId: string;
  clientName: string;
  matterName: string;
  opposingParty: string | null;
  matterType: string | null;
  status: FirmMatterStatus;
};

export type FirmKnowledge = {
  clients: FirmClient[];
  matters: FirmMatter[];
  source: "supabase" | "memory";
};

export type ConflictSeverity = "red" | "amber" | "clear";
export type CoiVerdict = "GO" | "CONDITIONAL" | "NO-GO";
export type ConflictRelation = "issuer" | "opposing_party" | "related_entity" | "incumbent";
export type ConflictAgainst =
  | "current_client"
  | "former_client"
  | "active_matter_adverse"
  | "closed_matter";

export type ConflictHit = {
  party: string;
  matchedName: string;
  relation: ConflictRelation;
  against: ConflictAgainst;
  severity: ConflictSeverity;
  detail: string;
};

export type ConflictReport = {
  rfpId: string;
  issuer: string;
  verdict: CoiVerdict;
  score: number;
  why: string;
  engine: "claude" | "heuristic";
  claudeFailed: boolean;
  hits: ConflictHit[];
  checkedAt: string;
};
