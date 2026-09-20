import { getSecret, type StoredLead } from "@helix/core";

const CALCOM_BASE = "https://api.cal.com/v2";

export function isCalcomConfigured(): boolean {
  return Boolean(getSecret("CALCOM_API_KEY") && getSecret("CALCOM_EVENT_TYPE_ID"));
}

export type CalcomSlot = { label: string; start: string };

export async function getCalcomAvailability(
  now = new Date()
): Promise<{ ok: boolean; slots: CalcomSlot[]; error?: string }> {
  const key = getSecret("CALCOM_API_KEY");
  const eventTypeId = getSecret("CALCOM_EVENT_TYPE_ID");
  if (!key || !eventTypeId) {
    return { ok: false, slots: [], error: "Cal.com is not configured" };
  }

  const start = now.toISOString();
  const end = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const res = await fetch(
    `${CALCOM_BASE}/slots?eventTypeId=${encodeURIComponent(eventTypeId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "cal-api-version": "2024-09-04",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    }
  );

  const payload = (await res.json().catch(() => ({}))) as {
    data?: Record<string, { start: string }[]>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, slots: [], error: payload.error?.message || `Cal.com HTTP ${res.status}` };
  }

  const byDay = payload.data ?? {};
  const slots: CalcomSlot[] = Object.values(byDay)
    .flat()
    .slice(0, 3)
    .map((s) => ({
      start: s.start,
      label: new Date(s.start).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: s.start.endsWith(":00.000Z") ? undefined : "2-digit",
      }),
    }));
  return { ok: true, slots };
}

export async function createCalcomBooking(
  lead: StoredLead,
  startIso: string
): Promise<{ ok: boolean; meetingLink?: string; error?: string }> {
  const key = getSecret("CALCOM_API_KEY");
  const eventTypeId = getSecret("CALCOM_EVENT_TYPE_ID");
  if (!key || !eventTypeId) {
    return { ok: false, error: "Cal.com is not configured" };
  }

  const res = await fetch(`${CALCOM_BASE}/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      eventTypeId: Number(eventTypeId),
      start: startIso,
      attendee: {
        name: lead.name,
        email: lead.email,
        timeZone: "UTC",
      },
      metadata: { helixLeadId: lead.id, helixTier: lead.tier },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    data?: { uid?: string; id?: string };
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, error: payload.error?.message || `Cal.com HTTP ${res.status}` };
  }
  const uid = payload.data?.uid || payload.data?.id;
  if (!uid) {
    return { ok: false, error: "Cal.com booking succeeded but returned no confirmation id" };
  }
  return { ok: true, meetingLink: `https://cal.com/booking/${uid}` };
}
