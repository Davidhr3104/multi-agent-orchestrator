import type {
  AttributedLead,
  MarketingWindow,
  SpendEvent,
  SpendRowInput,
} from "./types";

export const WINDOW_DAYS: Record<MarketingWindow, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function parseMarketingWindow(raw: string | null | undefined): MarketingWindow {
  if (raw === "30d" || raw === "90d" || raw === "7d") return raw;
  return "7d";
}

export function utcDay(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function addUtcDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function windowBounds(id: MarketingWindow, now: Date = new Date()): { from: string; to: string } {
  const to = utcDay(now);
  return { from: addUtcDays(to, -(WINDOW_DAYS[id] - 1)), to };
}

export function inWindow(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

export function rollupSpend(events: SpendEvent[]): SpendRowInput {
  const first = events[0];
  const impressions = events.reduce((s, e) => s + (e.impressions ?? 0), 0);
  const clicks = events.reduce((s, e) => s + (e.clicks ?? 0), 0);
  const formLeads = events.reduce((s, e) => s + (e.formLeads ?? 0), 0);
  return {
    campaignId: first.campaignId,
    name: events[events.length - 1]?.name ?? first.name,
    platform: first.platform,
    spend: Math.round(events.reduce((s, e) => s + e.spend, 0) * 100) / 100,
    impressions: impressions || undefined,
    clicks: clicks || undefined,
    formLeads: formLeads || undefined,
  };
}

export function splitJoinedAndUnmatched(
  events: SpendEvent[],
  leads: AttributedLead[],
  from: string,
  to: string
): { joined: SpendRowInput[]; unmatched: SpendEvent[] } {
  const ev = events.filter((e) => inWindow(e.occurredAt, from, to));
  const scoredIds = new Set(
    leads.filter((l) => inWindow(l.createdAt, from, to)).map((l) => l.campaignId)
  );
  const byCamp = new Map<string, SpendEvent[]>();
  for (const e of ev) {
    const rows = byCamp.get(e.campaignId) ?? [];
    rows.push(e);
    byCamp.set(e.campaignId, rows);
  }
  const joined: SpendRowInput[] = [];
  const unmatched: SpendEvent[] = [];
  for (const [campaignId, rows] of byCamp) {
    if (scoredIds.has(campaignId)) joined.push(rollupSpend(rows));
    else unmatched.push(...rows);
  }
  return { joined, unmatched };
}

export function dailySpendSeries(
  events: SpendEvent[],
  from: string,
  to: string
): { day: string; spend: number }[] {
  const map = new Map<string, number>();
  for (let day = from; day <= to; day = addUtcDays(day, 1)) map.set(day, 0);
  for (const e of events) {
    if (!inWindow(e.occurredAt, from, to)) continue;
    const day = e.occurredAt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + e.spend);
  }
  return [...map.entries()].map(([day, spend]) => ({
    day,
    spend: Math.round(spend * 100) / 100,
  }));
}
