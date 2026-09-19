import type { AttributedLead, CampaignScoreResult, SpendRowInput, StoredCampaign } from "./types";
import { scoreCampaignHeuristic } from "./heuristic";

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function runCampaignPipeline(
  spend: SpendRowInput,
  leads: AttributedLead[]
): StoredCampaign {
  const scored: CampaignScoreResult = scoreCampaignHeuristic(spend, leads);
  const status =
    scored.action === "pause"
      ? "pause_recommended"
      : scored.action === "scale"
        ? "scale_recommended"
        : "active";
  return {
    ...spend,
    ...scored,
    id: id("camp"),
    createdAt: new Date().toISOString(),
    runId: id("run"),
    status,
  };
}
