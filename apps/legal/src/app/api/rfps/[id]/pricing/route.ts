import {
  cacheHeuristicPricing,
  checkAndStorePricing,
  getRfp,
  saveRfp,
} from "@/lib/store";
import { isPracticeArea, type PricingOverrides } from "@/lib/pricing-types";
import type { StoredRfp } from "@helix/core";

export const runtime = "nodejs";

function asRfpSnapshot(value: unknown): StoredRfp | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StoredRfp>;
  if (!row.id || !row.title || !row.body) return null;
  return row as StoredRfp;
}

async function resolveRfp(id: string, body: unknown): Promise<StoredRfp | null> {
  const existing = await getRfp(id);
  if (existing) return existing;
  const bag = body && typeof body === "object" ? (body as { rfp?: unknown }) : null;
  const snapshot = asRfpSnapshot(bag?.rfp);
  if (snapshot && snapshot.id === id) {
    await saveRfp(snapshot);
    return snapshot;
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  const quote = await cacheHeuristicPricing(rfp);
  return Response.json({ quote });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const rfp = await resolveRfp(id, body);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  let overrides: PricingOverrides | undefined;
  const practiceArea =
    typeof body.practiceArea === "string" && isPracticeArea(body.practiceArea) ? body.practiceArea : undefined;
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
  const quote = await checkAndStorePricing(rfp, overrides);
  return Response.json({ quote });
}
