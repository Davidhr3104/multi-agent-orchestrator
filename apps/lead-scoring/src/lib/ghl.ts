import type { StoredLead } from "@helix/core";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export function isGhlConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

function splitName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(" ");
  return lastName ? { firstName, lastName } : { firstName };
}

export async function sendLeadToGhl(lead: StoredLead): Promise<{
  ok: boolean;
  mocked?: boolean;
  contactId?: string;
  error?: string;
}> {
  const key = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
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
      source: lead.source || "Helix for Leads",
      tags: ["helix", "lead-scoring", lead.tier, lead.classification],
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
  return { ok: true, contactId };
}

export async function addGhlReingestNote(contactId: string, score: number): Promise<void> {
  const key = process.env.GHL_API_KEY;
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
