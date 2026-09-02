import { attachIntelligence, scoreLeadHeuristic, type LeadIngestInput, type StoredLead } from "@helix/core";
import { supabaseListLeads, supabaseUpsertLead } from "./supabase-leads";

const memory = new Map<string, StoredLead>();
let seeded = false;

const SAMPLES: LeadIngestInput[] = [
  {
    name: "Maya Chen",
    email: "maya@northwindhvac.com",
    source: "GHL form",
    budget: "8500",
    timeline: "this month",
    message:
      "We need AI to score inbound HVAC quotes. Ready to start this month if it plugs into GoHighLevel.",
  },
  {
    name: "Luis Ortega",
    email: "luis@ortegraland.com",
    source: "referral",
    budget: "4000",
    timeline: "soon",
    message: "Landscaping company. Leads from Google Ads are 60% junk. Want classification + routing.",
  },
  {
    name: "Ava Brooks",
    email: "ava@example.org",
    source: "website",
    message: "Just looking at how the scoring works before we talk to sales.",
  },
  {
    name: "Crypto Blast",
    email: "buy@spam.invalid",
    source: "unknown",
    message: "Buy followers and crypto nft drop click here free money",
  },
  {
    name: "Jordan Hale",
    email: "jordan.hale@bookedjobs.example",
    source: "Upwork",
    budget: "12000",
    timeline: "this week",
    message:
      "Urgent: we close jobs from Facebook leads. Need hot/warm/cold in the dashboard and human review on mid scores. Evaluating HubSpot too.",
  },
];

function seedIfNeeded() {
  if (seeded) return;
  seeded = true;
  for (const sample of SAMPLES) {
    const scored = scoreLeadHeuristic(sample);
    const lead: StoredLead = attachIntelligence(
      {
        ...scored,
        id: `seed-${sample.email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
        createdAt: new Date(
          Date.now() -
            (sample.email.startsWith("ava@")
              ? 200 * 86400000
              : sample.email.startsWith("luis@")
                ? 190 * 86400000
                : memory.size * 36e5)
        ).toISOString(),
        runId: `seed-run-${memory.size}`,
        crmStatus: "not_sent",
        pipelineStage:
          scored.classification === "spam"
            ? "lost"
            : scored.classification === "lead" && scored.tier === "hot"
              ? "qualified"
              : "new",
        name: sample.name,
        email: sample.email,
        source: sample.source ?? "unknown",
        message: sample.message ?? "",
        budget: sample.budget,
        timeline: sample.timeline,
      },
      null,
      [...memory.values()]
    );
    memory.set(lead.id, lead);
  }
}

export async function listLeads(): Promise<StoredLead[]> {
  seedIfNeeded();
  const remote = await supabaseListLeads();
  if (remote && remote.length > 0) {
    for (const lead of remote) memory.set(lead.id, lead);
    return remote;
  }
  return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveLead(lead: StoredLead): Promise<StoredLead> {
  seedIfNeeded();
  memory.set(lead.id, lead);
  await supabaseUpsertLead(lead);
  return lead;
}

export async function getLead(id: string): Promise<StoredLead | null> {
  seedIfNeeded();
  if (memory.has(id)) return memory.get(id) ?? null;
  const all = await listLeads();
  return all.find((l) => l.id === id) ?? null;
}

export async function patchLead(
  id: string,
  patch: Partial<Omit<StoredLead, "id">>
): Promise<StoredLead | null> {
  const current = await getLead(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  return saveLead(next);
}

export async function deleteLeads(ids: string[]): Promise<number> {
  seedIfNeeded();
  let n = 0;
  for (const id of ids) {
    if (memory.delete(id)) n += 1;
  }
  return n;
}

export async function patchLeads(
  ids: string[],
  patch: Partial<Pick<StoredLead, "crmStatus" | "needsReview" | "pipelineStage">>
): Promise<StoredLead[]> {
  const out: StoredLead[] = [];
  for (const id of ids) {
    const next = await patchLead(id, patch);
    if (next) out.push(next);
  }
  return out;
}
