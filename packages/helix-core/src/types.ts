export type AgentId =
  | "orchestrator"
  | "extractor"
  | "factchecker"
  | "recommender"
  | "reviewer";

export type LogLevel = "info" | "decision" | "warn" | "error" | "success";

export type PipelineLog = {
  id: string;
  ts: string;
  agent: AgentId;
  level: LogLevel;
  message: string;
  field?: string;
  confidence?: number;
  evidence?: string;
};

export type ScoredField = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  evidence: string;
  quote: string;
  spanStart: number;
  spanEnd: number;
  verified: boolean;
  needsHuman: boolean;
};

export type AgentDecision = "approved" | "needs review" | "blocked";

export type AgentRun = {
  agent: AgentId;
  status: "idle" | "running" | "done" | "skipped" | "blocked";
  summary: string;
  confidence: number;
  decision?: AgentDecision;
};

export type LeadClassification = "lead" | "spam" | "info";
export type LeadTier = "hot" | "warm" | "cold";
export type CrmStatus = "not_sent" | "mocked" | "sent";
export type PipelineStage = "new" | "qualified" | "contacted" | "won" | "lost";

export type LeadIngestInput = {
  name: string;
  email: string;
  source?: string;
  message?: string;
  budget?: string;
  timeline?: string;
  phone?: string;
  company?: string;
  country?: string;
  region?: string;
  trade?: string;
  zip?: string;
  campaignId?: string;
  utmSource?: string;
  utmCampaign?: string;
};

export type SentimentLabel = "positive" | "neutral" | "negative";
export type BehaviorKind = "email_open" | "link_click" | "pricing_visit" | "no_reply_7d" | "email_reply";

export type ScoreHistoryEntry = {
  at: string;
  score: number;
  tier: LeadTier;
  reason: string;
};

export type BehaviorEvent = {
  at: string;
  kind: BehaviorKind;
  delta: number;
};

export type LeadEnrichment = {
  company: string;
  industry: string;
  employees: string;
  revenue: string;
  linkedin: string;
  techStack: string[];
  source: "heuristic" | "builtwith";
};

export type CompetitorHit = {
  name: string;
  talkingPoints: string[];
};

export type FollowUpPlan = {
  delay: "immediate" | "2h" | "24h";
  subject: string;
  preview: string;
  status: "queued" | "skipped";
};

export type SalesRep = {
  id: string;
  name: string;
  senior: boolean;
  territories: string[];
  industries: string[];
};

export type LeadScoreResult = {
  classification: LeadClassification;
  score: number;
  tier: LeadTier;
  confidence: number;
  reasoning: string;
  fields: ScoredField[];
  needsReview: boolean;
  engine: "claude" | "heuristic";
};

export type StoredLead = LeadScoreResult &
  LeadIngestInput & {
    id: string;
    orgId?: string;
    createdAt: string;
    runId: string;
    crmStatus: CrmStatus;
    ghlContactId?: string;
    ghlOpportunityId?: string;
    ghlOpportunityError?: string;
    pipelineStage?: PipelineStage;
    dealValue?: number;
    closedAt?: string;
    source: string;
    message: string;
    phone?: string;
    company?: string;
    country?: string;
    region?: string;
    duplicateOf?: string;
    reingestCount?: number;
    notes?: string[];
    enrichment?: LeadEnrichment;
    assignee?: string;
    routingReason?: string;
    behaviors?: BehaviorEvent[];
    baseScore?: number;
    scoreHistory?: ScoreHistoryEntry[];
    competitors?: CompetitorHit[];
    sentiment?: SentimentLabel;
    language?: "es" | "en" | "pt";
    followUp?: FollowUpPlan;
    decisionMaker?: string;
    meetingIntent?: boolean;
    agentTrace?: AgentRun[];
    outreachDraft?: string;
    meetingLink?: string;
    meetingConfirmedAt?: string;
    enrichedIndustry?: string | null;
    enrichedSize?: string | null;
    enrichedCountry?: string | null;
    assignedRepId?: string;
    battleCard?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };

export type LeadStreamEvent =
  | { type: "log"; log: PipelineLog }
  | { type: "agent"; run: AgentRun }
  | { type: "result"; lead: StoredLead }
  | { type: "error"; message: string };

export type LeadEmit = (event: LeadStreamEvent) => void;

export type RfpMethod = "BEAR" | "SPI" | "other";
export type RfpTier = "hot" | "warm" | "cold";
/** not_asked → never queried; live → real firm cites; unavailable → empty corpus; mocked → legacy stub */
export type CorpusStatus = "not_asked" | "live" | "unavailable" | "mocked";

export type CorpusHit = {
  docId: string;
  docTitle: string;
  chunkId: string;
  excerpt: string;
  quote: string;
  spanStart: number;
  spanEnd: number;
  score: number;
  verified: boolean;
};

export type RfpIngestInput = {
  title: string;
  issuer?: string;
  body: string;
  clientProfile?: string;
};

export type RfpScoreResult = {
  matchScore: number;
  tier: RfpTier;
  method: RfpMethod;
  amount: string;
  deadline: string;
  confidence: number;
  reasoning: string;
  fields: ScoredField[];
  unverifiedCount: number;
  needsReview: boolean;
  engine: "claude" | "heuristic";
};

export type PartnerVerdict = "GO" | "CONDITIONAL" | "NO-GO";

/** Closed-loop result after partner verdict — drives Legal win-rate story. */
export type MatterOutcome = "pending" | "won" | "lost" | "withdrawn" | "no_bid";

export type PartnerDecision = {
  verdict: PartnerVerdict;
  coiCleared: boolean;
  bidAmount?: string;
  notes?: string;
  decidedBy: string;
  decidedAt: string;
  /** Default pending for GO/CONDITIONAL; no_bid when verdict is NO-GO. */
  outcome?: MatterOutcome;
  outcomeAt?: string;
  outcomeNotes?: string;
  /** Actual fee / matter value when won (falls back to bidAmount in metrics). */
  wonAmount?: string;
};

export type StoredRfp = RfpScoreResult & {
  id: string;
  createdAt: string;
  runId: string;
  title: string;
  issuer: string;
  body: string;
  clientProfile: string;
  corpusStatus: CorpusStatus;
  /** Firm-document cites from Ask corpus (live retrieval). */
  corpusHits?: CorpusHit[];
  partnerDecision?: PartnerDecision;
};

export type RfpStreamEvent =
  | { type: "log"; log: PipelineLog }
  | { type: "agent"; run: AgentRun }
  | { type: "result"; rfp: StoredRfp }
  | { type: "error"; message: string };

export type RfpEmit = (event: RfpStreamEvent) => void;
