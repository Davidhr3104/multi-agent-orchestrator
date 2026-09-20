export { completeWithClaude, isClaudeConfigured, parseJsonObject } from "./claude";
export {
  getSecret,
  isGhlConfigured,
  keysGetResponse,
  keysPostResponse,
  onSecretsChanged,
  KEYS_COMMERCE,
  KEYS_INBOX,
  KEYS_LEADS,
  KEYS_LEGAL,
  KEYS_MARKETING,
  listSecretStatus,
  setSecrets,
  type SecretField,
  type SecretStatus,
} from "./secrets";
export { citeSpan, hydrateScoredField, missingCite } from "./fact";
export { autoSeedEnabled } from "./desk-mode";
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
export type { DomainEnrichment as DomainEnrichmentPayload } from "./lead/enrich";
export {
  draftOutreachHeuristic,
  lookalikeLeads,
  meetingSlots,
  resurrectLeads,
  roiMetrics,
  zombieLeads,
} from "./lead/growth";
export { parseGhlWebhook, parseLeadIngest, runLeadPipeline } from "./lead/pipeline";
export { leadScoringPrompt } from "./lead/prompts";
export { scoreRfpHeuristic, profileOverlap } from "./rfp/heuristic";
export { parseRfpIngest, runRfpPipeline } from "./rfp/pipeline";
export { DEFAULT_LEGAL_PROFILE, rfpScoringPrompt } from "./rfp/prompts";
export { scoreFraudHeuristic } from "./commerce/fraudHeuristic";
export { predictInventoryHeuristic } from "./commerce/inventoryHeuristic";
export { classifyInquiryHeuristic } from "./commerce/inquiryHeuristic";
export {
  runFraudScoring,
  runInventoryPrediction,
  runInquiryClassification,
} from "./commerce/pipeline";
export type {
  AiActionLog,
  FraudScoreResult,
  InquiryClassificationResult,
  InquiryInput,
  InquiryType,
  InventoryPredictionResult,
  OrderInput,
  OrderItem,
  ProductInput,
  RiskLevel,
  Sentiment,
  ShippingAddress,
  StoredInquiry,
  StoredOrder,
  StoredProduct,
} from "./commerce/types";
export { parseSpendCsv } from "./marketing/spendCsv";
export { joinCampaignMetrics, scoreCampaignHeuristic } from "./marketing/heuristic";
export { runCampaignPipeline } from "./marketing/pipeline";
export { buildMarketingSeed } from "./marketing/seed";
export {
  addUtcDays,
  dailySpendSeries,
  inWindow,
  parseMarketingWindow,
  splitJoinedAndUnmatched,
  utcDay,
  windowBounds,
  WINDOW_DAYS,
} from "./marketing/window";
export type {
  AdPlatform,
  AttributedLead,
  CampaignRemap,
  CampaignAction,
  CampaignMetrics,
  CampaignScoreResult,
  CampaignStatus,
  HitlDecision,
  MarketingWindow,
  SpendEvent,
  SpendRowInput,
  StoredCampaign,
  UnmatchedSpend,
} from "./marketing/types";
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
  PartnerDecision,
  PartnerVerdict,
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
