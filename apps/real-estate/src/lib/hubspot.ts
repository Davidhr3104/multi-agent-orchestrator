import { getSecret } from "@helix/core";
import type { Lead } from "./types";

/** Creates or updates a buyer as a HubSpot contact, matched by email (CRM v3 batch upsert). Active only with HUBSPOT_TOKEN. */

export const hubspotReady = () => Boolean(getSecret("HUBSPOT_TOKEN"));

export type HubspotResult = { ok: true; contactId: string; created: boolean } | { ok: false; error: string; notConfigured?: boolean };

export function hubspotProperties(lead: Lead): Record<string, string> {
  const [firstname, ...rest] = lead.name.trim().split(/\s+/);
  const props: Record<string, string> = { email: lead.email, firstname: firstname ?? "", lastname: rest.join(" ") };
  if (lead.phone) props.phone = lead.phone;
  return props;
}

export async function upsertHubspotContact(lead: Lead, fetchImpl: typeof fetch = fetch): Promise<HubspotResult> {
  const token = getSecret("HUBSPOT_TOKEN");
  if (!token) return { ok: false, notConfigured: true, error: "HubSpot isn't connected (set HUBSPOT_TOKEN)." };
  if (!lead.email) return { ok: false, error: `${lead.name} has no email, which HubSpot needs to match the contact.` };
  try {
    const res = await fetchImpl("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ inputs: [{ idProperty: "email", id: lead.email, properties: hubspotProperties(lead) }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = ((await res.json().catch(() => null)) as { message?: string } | null)?.message?.slice(0, 200);
      return { ok: false, error: `HubSpot refused the contact (${res.status})${detail ? `: ${detail}` : ""}.` };
    }
    const body = (await res.json().catch(() => null)) as { results?: { id?: string; new?: boolean }[] } | null;
    const first = body?.results?.[0];
    if (!first?.id) return { ok: false, error: "HubSpot answered without a contact id, so the push can't be confirmed." };
    return { ok: true, contactId: first.id, created: first.new === true };
  } catch {
    return { ok: false, error: "Couldn't reach HubSpot." };
  }
}
