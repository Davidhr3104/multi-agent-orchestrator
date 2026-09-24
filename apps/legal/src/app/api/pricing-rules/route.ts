import { loadPricingBook, createPricingRule } from "@/lib/pricing-knowledge";
import { isPracticeArea } from "@/lib/pricing-types";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET() {
  const book = await loadPricingBook();
  return Response.json(book);
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { practiceArea, minRate, maxRate, avgRate, jurisdiction } = body as {
    practiceArea?: string;
    minRate?: number;
    maxRate?: number;
    avgRate?: number;
    jurisdiction?: string;
  };
  if (!practiceArea || !isPracticeArea(practiceArea)) {
    return Response.json({ error: "practiceArea must be a valid practice area" }, { status: 400 });
  }
  if (![minRate, maxRate, avgRate].every((n) => typeof n === "number" && n >= 0)) {
    return Response.json({ error: "minRate, maxRate, avgRate must be non-negative numbers" }, { status: 400 });
  }
  const result = await createPricingRule({
    practiceArea,
    minRate: minRate!,
    maxRate: maxRate!,
    avgRate: avgRate!,
    jurisdiction: jurisdiction?.trim() || "US",
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ rule: result.rule });
}
