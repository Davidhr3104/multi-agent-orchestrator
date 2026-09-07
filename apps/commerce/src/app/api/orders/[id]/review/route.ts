import { patchOrder } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const decision = (body as { decision?: string } | null)?.decision;
  if (decision !== "approved" && decision !== "flagged" && decision !== "cancelled") {
    return Response.json(
      { error: "decision must be 'approved', 'flagged', or 'cancelled'" },
      { status: 400 }
    );
  }

  const order = await patchOrder(id, {
    reviewDecision: decision,
    reviewedBy: "human",
    reviewedAt: new Date().toISOString(),
    requiresReview: false,
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ order });
}
