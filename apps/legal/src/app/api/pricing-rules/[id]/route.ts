import { updatePricingRule, deletePricingRule } from "@/lib/pricing-knowledge";
import { deskWriteDenied } from "@/lib/ai-desk";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { minRate, maxRate, avgRate, jurisdiction } = body as {
    minRate?: number;
    maxRate?: number;
    avgRate?: number;
    jurisdiction?: string;
  };
  const result = await updatePricingRule(id, { minRate, maxRate, avgRate, jurisdiction });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;
  const result = await deletePricingRule(id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
