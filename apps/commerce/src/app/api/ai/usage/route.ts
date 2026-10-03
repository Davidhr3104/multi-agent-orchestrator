import {
  CLAUDE_MODEL,
  ESTIMATED_INPUT_USD_PER_MTOK,
  ESTIMATED_OUTPUT_USD_PER_MTOK,
  getAiCostTotals,
} from "@/lib/claude-usage";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ...getAiCostTotals(),
    model: CLAUDE_MODEL,
    pricing: { inputUsdPerMTok: ESTIMATED_INPUT_USD_PER_MTOK, outputUsdPerMTok: ESTIMATED_OUTPUT_USD_PER_MTOK, estimated: true },
  });
}
