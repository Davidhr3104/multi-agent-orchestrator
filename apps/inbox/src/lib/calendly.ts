import type { AgendaMeeting } from "@/lib/showing-schedule";

type CalendlyEvent = {
  uri?: string;
  name?: string;
  start_time?: string;
  end_time?: string;
  location?: { type?: string; location?: string; join_url?: string };
};

type CalendlyInvitee = {
  name?: string;
  email?: string;
  reschedule_url?: string;
  cancel_url?: string;
};

export type CalendlyAgenda = {
  connected: boolean;
  name: string | null;
  schedulingUrl: string | null;
  events: AgendaMeeting[];
  error: string | null;
};

async function calendlyGet(token: string, url: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
}

export async function fetchCalendlyAgenda(token: string, now = new Date()): Promise<CalendlyAgenda> {
  const empty: CalendlyAgenda = { connected: false, name: null, schedulingUrl: null, events: [], error: null };
  if (!token.trim()) return empty;
  const meRes = await calendlyGet(token, "https://api.calendly.com/users/me").catch(() => null);
  if (!meRes) return { ...empty, error: "Calendly did not respond." };
  if (meRes.status === 401 || meRes.status === 403) return { ...empty, error: "The Calendly token is not valid." };
  if (!meRes.ok) return { ...empty, error: `Calendly responded with ${meRes.status}.` };
  const me = (await meRes.json()) as { resource?: { uri?: string; name?: string; scheduling_url?: string } };
  const user = me.resource?.uri;
  if (!user) return { ...empty, error: "Calendly did not return the user." };

  const min = now.toISOString();
  const max = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const listUrl = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(user)}&status=active&sort=start_time:asc&count=20&min_start_time=${encodeURIComponent(min)}&max_start_time=${encodeURIComponent(max)}`;
  const listRes = await calendlyGet(token, listUrl).catch(() => null);
  if (!listRes?.ok) {
    return {
      connected: true,
      name: me.resource?.name ?? null,
      schedulingUrl: me.resource?.scheduling_url ?? null,
      events: [],
      error: "Could not read the Calendly meetings.",
    };
  }
  const list = (await listRes.json()) as { collection?: CalendlyEvent[] };
  const events = await Promise.all(
    (list.collection ?? []).slice(0, 20).map(async (event, index) => {
      const id = event.uri?.split("/").pop() ?? `cal-${index}`;
      const inviteeRes = event.uri ? await calendlyGet(token, `${event.uri}/invitees`).catch(() => null) : null;
      const invitee = inviteeRes?.ok
        ? ((await inviteeRes.json()) as { collection?: CalendlyInvitee[] }).collection?.[0]
        : undefined;
      const join = event.location?.join_url || "";
      const href = join || invitee?.reschedule_url || me.resource?.scheduling_url || "https://calendly.com";
      const place = event.location?.location || (join ? "Videollamada" : "Calendly");
      return {
        id: `calendly-${id}`,
        source: "calendly" as const,
        title: invitee?.name ? `${event.name || "Meeting"} · ${invitee.name}` : event.name || "Calendly meeting",
        start: event.start_time || min,
        end: event.end_time || min,
        location: place,
        href,
        hrefLabel: join ? "Join" : "Calendly",
      };
    })
  );
  return {
    connected: true,
    name: me.resource?.name ?? null,
    schedulingUrl: me.resource?.scheduling_url ?? null,
    events,
    error: null,
  };
}
