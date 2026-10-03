import { parseMarketingWindow } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { getAllSourceStatus } from "@/lib/ad-sources";
import { getAiUsageTotals } from "@/lib/ai-usage";
import { deskStatus } from "@/lib/store";
import { generateWasteReport, getLatestWasteReport } from "@/lib/waste-report";

export const runtime = "nodejs";

export async function GET() {
  const { mode } = await deskStatus();
  return Response.json({
    mode,
    report: getLatestWasteReport(),
    aiUsage: getAiUsageTotals(),
    sources: getAllSourceStatus(),
  });
}

/** Builds a fresh report now. Only analyses and proposes; it never pauses or scales. */
export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let windowRaw: string | null = null;
  try {
    windowRaw = ((await req.json()) as { window?: string }).window ?? null;
  } catch {
    windowRaw = null;
  }
  try {
    const report = await generateWasteReport({ window: parseMarketingWindow(windowRaw), trigger: "manual" });
    return Response.json({ report, aiUsage: getAiUsageTotals() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
