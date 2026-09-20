import { budgetNumber, getSecret, type StoredLead } from "@helix/core";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export function isGhlConfigured(): boolean {
  return Boolean(getSecret("GHL_API_KEY") && getSecret("GHL_LOCATION_ID"));
}

function splitName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(" ");
  return lastName ? { firstName, lastName } : { firstName };
}

export function isGhlPipelineConfigured(): boolean {
  return Boolean(
    getSecret("GHL_PIPELINE_ID") &&
      getSecret("GHL_STAGE_HOT") &&
      getSecret("GHL_STAGE_WARM") &&
      getSecret("GHL_STAGE_COLD")
  );
}

function stageIdForTier(tier: StoredLead["tier"]): string {
  if (tier === "hot") return getSecret("GHL_STAGE_HOT");
  if (tier === "warm") return getSecret("GHL_STAGE_WARM");
  return getSecret("GHL_STAGE_COLD");
}

export async function upsertGhlOpportunity(
  lead: StoredLead,
  contactId: string
): Promise<{ ok: boolean; opportunityId?: string; error?: string }> {
  const key = getSecret("GHL_API_KEY");
  const locationId = getSecret("GHL_LOCATION_ID");
  const pipelineId = getSecret("GHL_PIPELINE_ID");
  const pipelineStageId = stageIdForTier(lead.tier);
  if (!key || !locationId || !pipelineId || !pipelineStageId) {
    return { ok: false, error: "GHL pipeline routing is not fully configured" };
  }

  const res = await fetch(`${GHL_BASE}/opportunities/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      locationId,
      pipelineId,
      pipelineStageId,
      contactId,
      name: `${lead.name} — ${lead.company || lead.source || "Helix lead"}`,
      status: "open",
      monetaryValue: budgetNumber(lead.budget) ?? undefined,
      source: lead.source || "Helix for Leads",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    opportunity?: { id?: string };
    id?: string;
    message?: string;
  };
  const opportunityId = payload.opportunity?.id || payload.id;
  if (!res.ok || !opportunityId) {
    return { ok: false, error: payload.message || `GHL HTTP ${res.status}` };
  }
  return { ok: true, opportunityId };
}

export async function sendLeadToGhl(lead: StoredLead): Promise<{
  ok: boolean;
  mocked?: boolean;
  contactId?: string;
  opportunityId?: string;
  opportunityError?: string;
  error?: string;
}> {
  const key = getSecret("GHL_API_KEY");
  const locationId = getSecret("GHL_LOCATION_ID");
  if (!key || !locationId) {
    return { ok: false, mocked: true };
  }

  const names = splitName(lead.name);
  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      locationId,
      ...names,
      email: lead.email,
      phone: lead.phone || undefined,
      source: lead.source || "Helix for Leads",
      tags: ["helix", "lead-scoring", lead.tier, lead.classification, lead.trade].filter(Boolean),
      customFields: [
        lead.campaignId ? { key: "campaign_id", field_value: lead.campaignId } : null,
        lead.trade ? { key: "trade", field_value: lead.trade } : null,
        lead.zip ? { key: "zip", field_value: lead.zip } : null,
      ].filter(Boolean),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    contact?: { id?: string };
    id?: string;
    message?: string;
  };
  const contactId = payload.contact?.id || payload.id;
  if (!res.ok || !contactId) {
    return { ok: false, error: payload.message || `GHL HTTP ${res.status}` };
  }

  if (!isGhlPipelineConfigured()) {
    return { ok: true, contactId };
  }
  const opp = await upsertGhlOpportunity(lead, contactId);
  if (!opp.ok) {
    // Contact write already succeeded — surface the pipeline failure without hiding it, per no-silent-failure rule.
    return { ok: true, contactId, opportunityError: opp.error };
  }
  return { ok: true, contactId, opportunityId: opp.opportunityId };
}

export async function addGhlReingestNote(contactId: string, score: number): Promise<void> {
  const key = getSecret("GHL_API_KEY");
  if (!key) return;
  await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      body: `Lead re-ingested. Score updated to ${score}.`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}
