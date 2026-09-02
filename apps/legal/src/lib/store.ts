import {
  DEFAULT_LEGAL_PROFILE,
  scoreRfpHeuristic,
  type RfpIngestInput,
  type StoredRfp,
} from "@helix/core";

let clientProfile = DEFAULT_LEGAL_PROFILE;

export function getClientProfile(): string {
  return clientProfile;
}

export function setClientProfile(next: string): string | null {
  const trimmed = next.trim();
  if (trimmed.length < 24) return null;
  clientProfile = trimmed;
  return clientProfile;
}

const memory = new Map<string, StoredRfp>();
let seeded = false;

const SAMPLES: RfpIngestInput[] = [
  {
    title: "Medical record abstraction — mass tort docket",
    issuer: "Northstar PI Consortium",
    body: "Due: 2026-09-18. Budget $85k. Method: BEAR. Need clinical chart review and IME summarization for personal injury files in Texas. Submit by September 18, 2026.",
  },
  {
    title: "SPI coding for workers' compensation clinic",
    issuer: "Harbor Occupational Health",
    body: "Deadline 2026-10-02. $42,000. SPI preferred. Extract ICD and work-status from clinical notes. Injury clinic, not a software vendor RFP.",
  },
  {
    title: "County IT — Kubernetes refresh",
    issuer: "Lake County CIO",
    body: "Due 2026-11-01. $210k for cluster migration and SaaS catalog sync. No medical records. Shopify-adjacent vendor portal.",
  },
  {
    title: "Clinical NLP RFP (thin posting)",
    issuer: "Unspecified",
    body: "Looking for AI help with documents. Timeline TBD. Method not stated.",
  },
];

function seedIfNeeded() {
  if (seeded) return;
  seeded = true;
  for (const sample of SAMPLES) {
    const scored = scoreRfpHeuristic(sample);
    const rfp: StoredRfp = {
      ...scored,
      id: `seed-${sample.title.replace(/[^a-z0-9]/gi, "").slice(0, 14)}`,
      createdAt: new Date(Date.now() - memory.size * 36e5).toISOString(),
      runId: `seed-run-${memory.size}`,
      title: sample.title,
      issuer: sample.issuer ?? "unspecified",
      body: sample.body,
      clientProfile: sample.clientProfile ?? getClientProfile(),
      corpusStatus: "not_asked",
    };
    memory.set(rfp.id, rfp);
  }
}

export async function listRfps(): Promise<StoredRfp[]> {
  seedIfNeeded();
  return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRfp(rfp: StoredRfp): Promise<StoredRfp> {
  seedIfNeeded();
  memory.set(rfp.id, rfp);
  return rfp;
}

export async function getRfp(id: string): Promise<StoredRfp | null> {
  seedIfNeeded();
  return memory.get(id) ?? null;
}

export async function patchRfp(
  id: string,
  patch: Partial<Pick<StoredRfp, "needsReview" | "corpusStatus">>
): Promise<StoredRfp | null> {
  const current = await getRfp(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  return saveRfp(next);
}
