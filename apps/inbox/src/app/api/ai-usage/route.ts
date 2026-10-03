import { summarizeAiUsage } from "@/lib/ai-usage";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(summarizeAiUsage());
}
