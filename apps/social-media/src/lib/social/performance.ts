import type { AccountSummary, RealPost } from "./meta-graph";

/** Every number in this file is computed from what the Graph API returned. Nothing is estimated or filled in. */

export type RankedPost = RealPost & { interactions: number; engagementRate: number | null };

export function interactionsOf(p: RealPost): number {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0);
}

export function ranked(p: RealPost): RankedPost {
  const interactions = interactionsOf(p);
  return { ...p, interactions, engagementRate: p.reach && p.reach > 0 ? interactions / p.reach : null };
}

/** Posts with reach rank by interactions per reached account; posts without reach follow, by raw interactions. */
export function rankPosts(posts: RealPost[]): RankedPost[] {
  return posts.map(ranked).sort((a, b) => {
    if (a.engagementRate !== null && b.engagementRate !== null) return b.engagementRate - a.engagementRate || b.interactions - a.interactions;
    if (a.engagementRate !== null) return -1;
    if (b.engagementRate !== null) return 1;
    return b.interactions - a.interactions;
  });
}

export function topPosts(posts: RealPost[], n = 3): RankedPost[] {
  return rankPosts(posts.filter((p) => interactionsOf(p) > 0 || (p.reach ?? 0) > 0)).slice(0, n);
}

export type WeeklyMetrics = {
  periodStart: string;
  periodEnd: string;
  posts: number;
  previousPosts: number;
  interactions: number;
  previousInteractions: number;
  /** Sum of post reach where the API returned it. Null when no post in the week had reach. */
  reach: number | null;
  postsWithReach: number;
  engagementRate: number | null;
  best: RankedPost | null;
  byNetwork: { network: RealPost["network"]; posts: number; interactions: number; reach: number | null }[];
  accounts: AccountSummary[];
};

const DAY = 86_400_000;

function sumReach(posts: RealPost[]): number | null {
  const withReach = posts.filter((p) => p.reach !== null);
  return withReach.length ? withReach.reduce((s, p) => s + (p.reach ?? 0), 0) : null;
}

export function computeWeeklyMetrics(posts: RealPost[], accounts: AccountSummary[], now = new Date()): WeeklyMetrics {
  const end = now.getTime();
  const start = end - 7 * DAY;
  const prevStart = start - 7 * DAY;
  const at = (p: RealPost) => Date.parse(p.publishedAt);
  const week = posts.filter((p) => at(p) > start && at(p) <= end);
  const prev = posts.filter((p) => at(p) > prevStart && at(p) <= start);
  const interactions = week.reduce((s, p) => s + interactionsOf(p), 0);
  const reachRows = week.filter((p) => p.reach !== null && p.reach > 0);
  const reachSum = reachRows.reduce((s, p) => s + (p.reach ?? 0), 0);
  const reachInteractions = reachRows.reduce((s, p) => s + interactionsOf(p), 0);
  const networks = [...new Set(week.map((p) => p.network))];
  return {
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    posts: week.length,
    previousPosts: prev.length,
    interactions,
    previousInteractions: prev.reduce((s, p) => s + interactionsOf(p), 0),
    reach: sumReach(week),
    postsWithReach: reachRows.length,
    engagementRate: reachSum > 0 ? reachInteractions / reachSum : null,
    best: rankPosts(week)[0] ?? null,
    byNetwork: networks.map((network) => {
      const rows = week.filter((p) => p.network === network);
      return { network, posts: rows.length, interactions: rows.reduce((s, p) => s + interactionsOf(p), 0), reach: sumReach(rows) };
    }),
    accounts,
  };
}

export type Fact = { label: string; value: string };

const int = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The only numbers the weekly report may contain, already formatted. */
export function weeklyFacts(m: WeeklyMetrics): Fact[] {
  const facts: Fact[] = [
    { label: "Period", value: `${day(m.periodStart)} to ${day(m.periodEnd)}` },
    { label: "Posts published this week", value: int(m.posts) },
    { label: "Posts published the week before", value: int(m.previousPosts) },
    { label: "Interactions this week (likes + comments + saves + shares)", value: int(m.interactions) },
    { label: "Interactions the week before", value: int(m.previousInteractions) },
  ];
  if (m.reach !== null) facts.push({ label: `Summed post reach this week (${int(m.postsWithReach)} posts reported reach)`, value: int(m.reach) });
  if (m.engagementRate !== null) facts.push({ label: "Interactions per reached account", value: pct(m.engagementRate) });
  for (const row of m.byNetwork) facts.push({ label: `${row.network} posts / interactions this week`, value: `${int(row.posts)} / ${int(row.interactions)}` });
  if (m.best) {
    facts.push({ label: "Best post this week", value: `${m.best.network} post from ${day(m.best.publishedAt)}: "${m.best.caption.slice(0, 80).replace(/\d/g, "")}"` });
    facts.push({ label: "Best post interactions", value: int(m.best.interactions) });
    if (m.best.engagementRate !== null) facts.push({ label: "Best post interactions per reached account", value: pct(m.best.engagementRate) });
  }
  for (const a of m.accounts) {
    if (a.followers !== null) facts.push({ label: `${a.name} followers`, value: int(a.followers) });
    if (a.reach !== null) facts.push({ label: `${a.name} account reach, last ${a.periodDays} days`, value: int(a.reach) });
    if (a.interactions !== null) facts.push({ label: `${a.name} account interactions, last ${a.periodDays} days`, value: int(a.interactions) });
  }
  return facts;
}

/** Numeric tokens in text, normalized ("1,234" -> "1234", "4.5%" -> "4.5"). */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""));
}

/** True when every number in the prose also appears in the computed facts. */
export function proseUsesOnlyFacts(prose: string, facts: Fact[]): boolean {
  const allowed = new Set(facts.flatMap((f) => [...numbersIn(f.label), ...numbersIn(f.value)]));
  return numbersIn(prose).every((n) => allowed.has(n));
}

export function factsProse(facts: Fact[]): string {
  return facts.map((f) => `${f.label}: ${f.value}.`).join(" ");
}
