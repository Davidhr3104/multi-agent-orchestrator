import type {
  AttributedLead,
  CampaignAction,
  CampaignMetrics,
  CampaignScoreResult,
  SpendRowInput,
} from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function joinCampaignMetrics(
  spend: SpendRowInput,
  leads: AttributedLead[]
): CampaignMetrics {
  const mine = leads.filter((l) => l.campaignId === spend.campaignId);
  const usable = mine.filter((l) => l.classification !== "spam");
  const nSpam = mine.filter((l) => l.classification === "spam").length;
  const nHot = usable.filter((l) => l.tier === "hot").length;
  const avgScore =
    usable.length === 0 ? 0 : usable.reduce((s, l) => s + l.score, 0) / usable.length;
  const formLeads = spend.formLeads ?? mine.length;
  const cpl = formLeads > 0 ? spend.spend / formLeads : null;
  const costPerHot = nHot > 0 ? spend.spend / nHot : null;
  return {
    campaignId: spend.campaignId,
    nLeads: mine.length,
    nSpam,
    avgScore: round(avgScore),
    nHot,
    formLeads,
    cpl: cpl == null ? null : round(cpl),
    costPerHot: costPerHot == null ? null : round(costPerHot),
  };
}

export function scoreCampaignHeuristic(
  spend: SpendRowInput,
  leads: AttributedLead[]
): CampaignScoreResult {
  const metrics = joinCampaignMetrics(spend, leads);
  const spamRate = metrics.nLeads === 0 ? 0 : metrics.nSpam / metrics.nLeads;
  const thin = metrics.nLeads < 8;

  let action: CampaignAction = "keep";
  if (metrics.nLeads >= 8 && (metrics.avgScore <= 35 || spamRate >= 0.45)) {
    action = "pause";
  } else if (metrics.nHot >= 3 && metrics.avgScore >= 70 && (metrics.costPerHot ?? 9999) < 80) {
    action = "scale";
  } else if (metrics.nLeads >= 15 && metrics.avgScore < 45) {
    action = "pause";
  }

  const confidence = thin ? 0.48 : action === "keep" ? 0.62 : 0.82;
  const needsReview = confidence < 0.65 || thin || action === "keep";

  const reasoning = [
    `${spend.name}: spend $${spend.spend.toFixed(0)}, ${metrics.formLeads} forms, ${metrics.nLeads} scored leads, avg score ${metrics.avgScore}, ${metrics.nHot} hot.`,
    metrics.costPerHot == null
      ? "No hot leads — cost per hot is undefined."
      : `Cost per hot lead $${metrics.costPerHot}.`,
    action === "pause"
      ? "Recommend pause: volume without quality (or spam-heavy)."
      : action === "scale"
        ? "Recommend scale: high score, affordable hot leads. Human still confirms."
        : "Keep running. Mid band or not enough data for a hard call.",
  ].join(" ");

  return {
    action,
    confidence,
    reasoning,
    needsReview,
    metrics,
    engine: "heuristic",
    demoMode: true,
  };
}
