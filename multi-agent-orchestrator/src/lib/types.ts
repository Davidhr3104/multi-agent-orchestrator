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

export type LogLevel = "info" | "decision" | "warn" | "error" | "success";

export type PipelineLog = {
  id: string;
  ts: string;
  agent: AgentId;
  level: LogLevel;
  message: string;
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

export type AgentRun = {
  agent: AgentId;
  status: "idle" | "running" | "done" | "skipped" | "blocked";
  summary: string;
  confidence: number;
};

export type PipelineResult = {
  inputKind: InputKind;
  sourceText: string;
  sourceUrl?: string;
  fields: ScoredField[];
  claims: Claim[];
  recommendations: Recommendation[];
  reviews: ReviewNote[];
  agents: AgentRun[];
  overallConfidence: number;
  humanRequired: boolean;
};

export type AnalyzeRequest = {
  text?: string;
  url?: string;
  permissions: PermissionMap;
};

export type StreamEvent =
  | { type: "log"; log: PipelineLog }
  | { type: "agent"; run: AgentRun }
  | { type: "result"; result: PipelineResult }
  | { type: "error"; message: string };
