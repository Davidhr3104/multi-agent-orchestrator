import {
  cacheHeuristicConflict,
  checkAndStoreConflict,
  getCachedConflict,
  getRfp,
  saveRfp,
} from "@/lib/store";
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
    // Soft-hydrate so sibling desk routes on this isolate can find the RFP.
    await saveRfp(snapshot);
    return snapshot;
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  const report = getCachedConflict(id) ?? (await cacheHeuristicConflict(rfp));
  return Response.json({ report });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const rfp = await resolveRfp(id, body);
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  const report = await checkAndStoreConflict(rfp);
  return Response.json({ report });
}
