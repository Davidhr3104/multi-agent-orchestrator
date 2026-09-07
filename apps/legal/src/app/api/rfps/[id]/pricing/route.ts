import { cacheHeuristicPricing, checkAndStorePricing, getRfp } from "@/lib/store";
import { isPracticeArea, type PricingOverrides } from "@/lib/pricing-types";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  const quote = await cacheHeuristicPricing(rfp);
  return Response.json({ quote });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  let overrides: PricingOverrides | undefined;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const practiceArea = typeof body.practiceArea === "string" && isPracticeArea(body.practiceArea) ? body.practiceArea : undefined;
    const complexityScore =
      typeof body.complexityScore === "number" && Number.isFinite(body.complexityScore)
        ? Math.max(1, Math.min(10, Math.round(body.complexityScore)))
        : undefined;
    const estimatedHours =
      typeof body.estimatedHours === "number" && Number.isFinite(body.estimatedHours)
        ? Math.max(8, Math.round(body.estimatedHours))
        : undefined;
    if (practiceArea || complexityScore || estimatedHours) {
      overrides = { practiceArea, complexityScore, estimatedHours };
    }
  } catch {
    overrides = undefined;
  }
  const quote = await checkAndStorePricing(rfp, overrides);
  return Response.json({ quote });
}
