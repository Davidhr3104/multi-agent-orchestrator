export type AgentId = "orchestrator" | "extractor" | "recommender" | "reviewer";

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
  needsHuman: boolean;
};

export type AgentDecision = "aprobado" | "requiere revisión" | "bloqueado";

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

export type LeadIngestInput = {
  name: string;
  email: string;
  source?: string;
  message?: string;
  budget?: string;
  timeline?: string;
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
    createdAt: string;
    runId: string;
    crmStatus: CrmStatus;
    source: string;
    message: string;
  };

export type LeadStreamEvent =
  | { type: "log"; log: PipelineLog }
  | { type: "agent"; run: AgentRun }
  | { type: "result"; lead: StoredLead }
  | { type: "error"; message: string };

export type LeadEmit = (event: LeadStreamEvent) => void;
