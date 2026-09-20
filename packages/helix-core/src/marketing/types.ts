import type { LeadClassification, LeadTier } from "../types";

export type AdPlatform = "meta" | "google" | "other";
export type CampaignAction = "pause" | "scale" | "keep";
export type CampaignStatus =
  | "active"
  | "pause_recommended"
  | "paused"
  | "scale_recommended";

export type MarketingWindow = "7d" | "30d" | "90d";

export type SpendRowInput = {
  campaignId: string;
  name: string;
  platform: AdPlatform;
  spend: number;
  impressions?: number;
  clicks?: number;
  formLeads?: number;
  occurredAt?: string;
};

export type SpendEvent = SpendRowInput & {
  id: string;
  occurredAt: string;
};

export type AttributedLead = {
  id: string;
  campaignId: string;
  name: string;
  email: string;
  classification: LeadClassification;
  score: number;
  tier: LeadTier;
  confidence: number;
  createdAt: string;
};

export type HitlDecision = {
  campaignId: string;
  action: CampaignAction;
  note?: string;
  at: string;
  actor?: string;
};

export type CampaignRemap = {
  spendCampaignId: string;
  leadCampaignId: string;
};

export type UnmatchedSpend = SpendEvent & {
  reason: "no_scored_leads";
};

export type CampaignMetrics = {
  campaignId: string;
  nLeads: number;
  nSpam: number;
  avgScore: number;
  nHot: number;
  formLeads: number;
  cpl: number | null;
  costPerHot: number | null;
  /** Spend attributed to spam-classified leads (proportional). */
  spendOnSpam: number;
  spamRate: number;
};

export type DeskWasteSummary = {
  totalSpend: number;
  spendOnSpam: number;
  spendOnHotShare: number;
  wastePct: number;
  nSpam: number;
  nHot: number;
  nLeads: number;
  costPerHot: number | null;
  worstCampaignId: string | null;
  worstCampaignName: string | null;
  worstSpendOnSpam: number;
};

export type CampaignScoreResult = {
  action: CampaignAction;
  confidence: number;
  reasoning: string;
  needsReview: boolean;
  metrics: CampaignMetrics;
  engine: "claude" | "heuristic";
  demoMode: boolean;
};

export type StoredCampaign = SpendRowInput &
  CampaignScoreResult & {
    id: string;
    createdAt: string;
    runId: string;
    status: CampaignStatus;
    hitlNote?: string;
  };
