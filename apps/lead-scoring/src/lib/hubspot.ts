import { getSecret, type StoredLead } from "@helix/core";

const HUBSPOT_BASE = "https://api.hubapi.com";

export function isHubspotConfigured(): boolean {
  return Boolean(getSecret("HUBSPOT_TOKEN"));
}

function splitName(name: string): { firstname: string; lastname?: string } {
  const parts = name.trim().split(/\s+/);
  const firstname = parts[0] || name;
  const lastname = parts.slice(1).join(" ");
  return lastname ? { firstname, lastname } : { firstname };
}

/** Only HubSpot default contact properties, so the push works on a fresh portal with no custom fields. */
export function hubspotContactProperties(lead: Pick<StoredLead, "name" | "email" | "phone" | "company">) {
  const props: Record<string, string> = { email: lead.email.trim(), ...splitName(lead.name) };
  if (lead.phone?.trim()) props.phone = lead.phone.trim();
  if (lead.company?.trim()) props.company = lead.company.trim();
  return props;
}

export type HubspotUpsertResult =
  | { ok: true; contactId: string; created: boolean }
  | { ok: false; mocked?: true; error: string; status?: number };

async function hubspotFetch(token: string, path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  return { res, payload };
}

/**
 * Upsert by email with the CRM v3 contacts API: PATCH the contact addressed by email
 * (idProperty=email); a 404 means it does not exist yet, so POST creates it.
 * ok=true only when HubSpot answered 2xx with a contact id.
 */
export async function upsertHubspotContact(
  lead: Pick<StoredLead, "name" | "email" | "phone" | "company">
): Promise<HubspotUpsertResult> {
  const token = getSecret("HUBSPOT_TOKEN");
  if (!token) return { ok: false, mocked: true, error: "HUBSPOT_TOKEN is not set" };
  const email = lead.email.trim();
  if (!email) return { ok: false, error: "Lead has no email to upsert by" };
  const properties = hubspotContactProperties(lead);

  try {
    const patched = await hubspotFetch(
      token,
      `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
      { method: "PATCH", body: { properties } }
    );
    if (patched.res.ok && patched.payload.id) {
      return { ok: true, contactId: String(patched.payload.id), created: false };
    }
    if (patched.res.status !== 404) {
      return {
        ok: false,
        status: patched.res.status,
        error: patched.payload.message || `HubSpot HTTP ${patched.res.status}`,
      };
    }

    const created = await hubspotFetch(token, "/crm/v3/objects/contacts", {
      method: "POST",
      body: { properties },
    });
    if (created.res.ok && created.payload.id) {
      return { ok: true, contactId: String(created.payload.id), created: true };
    }
    return {
      ok: false,
      status: created.res.status,
      error: created.payload.message || `HubSpot HTTP ${created.res.status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
