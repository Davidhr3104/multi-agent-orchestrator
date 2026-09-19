import type { LeadClassification, LeadTier } from "../types";

export type AdPlatform = "meta" | "google" | "other";
export type CampaignAction = "pause" | "scale" | "keep";
export type CampaignStatus =
  | "active"
  | "pause_recommended"
  | "paused"
  | "scale_recommended";

export type SpendRowInput = {
  campaignId: string;
  name: string;
  platform: AdPlatform;
  spend: number;
  impressions?: number;
  clicks?: number;
  formLeads?: number;
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
