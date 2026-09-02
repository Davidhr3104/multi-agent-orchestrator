export { completeWithClaude, isClaudeConfigured, parseJsonObject } from "./claude";
export { citeSpan, hydrateScoredField, missingCite } from "./fact";
export { encodeSse } from "./sse";
export { scoreLeadHeuristic } from "./lead/heuristic";
export {
  applyBehavior,
  attachIntelligence,
  findDuplicate,
  isBehaviorKind,
  sourceAttribution,
} from "./lead/intelligence";
export { domainFromEmail, enrichEmailDomain } from "./lead/enrich";
export {
  draftOutreachHeuristic,
  lookalikeLeads,
  meetingSlots,
  resurrectLeads,
  roiMetrics,
  zombieLeads,
} from "./lead/growth";
export { parseLeadIngest, runLeadPipeline } from "./lead/pipeline";
export { leadScoringPrompt } from "./lead/prompts";
export { scoreRfpHeuristic, profileOverlap } from "./rfp/heuristic";
export { parseRfpIngest, runRfpPipeline } from "./rfp/pipeline";
export { DEFAULT_LEGAL_PROFILE, rfpScoringPrompt } from "./rfp/prompts";
export type {
  AgentDecision,
  AgentId,
  AgentRun,
  CorpusStatus,
  CrmStatus,
  LeadClassification,
  LeadEmit,
  LeadEnrichment,
  LeadIngestInput,
  LeadScoreResult,
  LeadStreamEvent,
  LeadTier,
  PipelineLog,
  PipelineStage,
  RfpEmit,
  RfpIngestInput,
  RfpMethod,
  RfpScoreResult,
  RfpStreamEvent,
  RfpTier,
  ScoredField,
  StoredLead,
  StoredRfp,
} from "./types";
