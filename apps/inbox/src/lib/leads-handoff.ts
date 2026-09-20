import { getSecret } from "@helix/core";
import type { EmailThread } from "@/lib/types";

export function isLeadsHandoffConfigured(): boolean {
  return Boolean(getSecret("HELIX_LEADS_WEBHOOK_URL"));
}

/**
 * Hands a buyer-intent thread off to Helix for Leads by POSTing to that
 * desk's per-org GHL webhook URL (same one configured under Settings →
 * Workspace there) — reuses its full scoring/HITL/GHL pipeline rather than
 * duplicating lead intelligence here.
 */
export async function sendToLeadsDesk(
  thread: EmailThread
): Promise<{ ok: true; leadId?: string } | { ok: false; error: string }> {
  const url = getSecret("HELIX_LEADS_WEBHOOK_URL");
  if (!url) {
    return { ok: false, error: "HELIX_LEADS_WEBHOOK_URL required. Paste it in Settings." };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: thread.fromName || thread.fromEmail,
      email: thread.fromEmail,
      source: "Helix for Inbox",
      message: `${thread.subject}\n\n${thread.body}`.trim(),
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) {
    return { ok: false, error: "Could not reach Helix for Leads webhook." };
  }
  const payload = (await res.json().catch(() => ({}))) as { lead?: { id?: string }; error?: string };
  if (!res.ok) {
    return { ok: false, error: payload.error || `Leads webhook HTTP ${res.status}` };
  }
  return { ok: true, leadId: payload.lead?.id };
}
