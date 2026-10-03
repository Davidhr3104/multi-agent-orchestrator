import { getUsage } from "@/lib/usage";
import { isClaudeConfigured } from "@helix/core";
import { isGhlConfigured } from "@/lib/ghl";
import { isHubspotConfigured } from "@/lib/hubspot";
import { getAiCostSummary } from "@/lib/ai-cost";
import { DRAFT_MODEL, TRIAGE_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ...getUsage(),
    claudeKey: isClaudeConfigured(),
    ghlKey: isGhlConfigured(),
    hubspotKey: isHubspotConfigured(),
    aiCost: getAiCostSummary(),
    models: { triage: TRIAGE_MODEL, draft: DRAFT_MODEL },
  });
}
