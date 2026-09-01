export type AgentId =
  | "orchestrator"
  | "extractor"
  | "seo"
  | "factcheck"
  | "recommender"
  | "reviewer";

export type InputKind = "url" | "article" | "copy";

export type PermissionKey =
  | "read_input"
  | "fetch_url"
  | "write_structured"
  | "analyze_seo"
  | "verify_claims"
  | "write_recommendations"
  | "peer_review"
  | "request_human";

export type PermissionMap = Record<AgentId, PermissionKey[]>;

export type AgentEnabledMap = Record<AgentId, boolean>;

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

export type Claim = {
  text: string;
  status: "supported" | "unverified" | "conflicted";
  confidence: number;
  note: string;
};

export type Recommendation = {
  title: string;
  detail: string;
  priority: "alta" | "media" | "baja";
  confidence: number;
};

export type ReviewNote = {
  targetAgent: AgentId;
  verdict: "approve" | "revise" | "block";
  comment: string;
};

export type AgentDecision = "aprobado" | "requiere revisión" | "bloqueado";

export type AgentRun = {
  agent: AgentId;
  status: "idle" | "running" | "done" | "skipped" | "blocked";
  summary: string;
  confidence: number;
  decision?: AgentDecision;
};

export type PipelineThresholds = {
  minConfidence: number;
  hitlThreshold: number;
};

export type PipelineResult = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  inputKind: InputKind;
  sourceText: string;
  sourceUrl?: string;
  fields: ScoredField[];
  claims: Claim[];
  recommendations: Recommendation[];
  reviews: ReviewNote[];
  agents: AgentRun[];
  logs: PipelineLog[];
  overallConfidence: number;
  humanRequired: boolean;
  activeAgents: number;
  thresholds: PipelineThresholds;
  claudeEnabled: boolean;
  supabaseEnabled: boolean;
};

export type AnalyzeRequest = {
  text?: string;
  url?: string;
  permissions: PermissionMap;
  enabledAgents: AgentEnabledMap;
  minConfidence: number;
  hitlThreshold: number;
};

export type StreamEvent =
  | { type: "log"; log: PipelineLog }
  | { type: "agent"; run: AgentRun }
  | { type: "result"; result: PipelineResult }
  | { type: "error"; message: string };
