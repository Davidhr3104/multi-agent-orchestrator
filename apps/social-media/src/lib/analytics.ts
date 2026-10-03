import type { Channel, Pillar, PostStatus } from "./types";
import { addDaysKey, dayKey, zoneParts } from "./tz";
import { CHANNEL_ORDER, PILLAR_ORDER, READINESS_BANDS } from "./visuals";

export type ScoreBand = { perfect: number; below: number; perfectApproved: number; belowApproved: number };

const PILLARS: Pillar[] = PILLAR_ORDER;

/** Calendar facts only. There is no engagement here, because nothing has been published. */
export function summarizeCalendar(posts: { pillar: Pillar; status: PostStatus; score: number }[]) {
  const pillars = PILLARS.map((pillar) => {
    const rows = posts.filter((post) => post.pillar === pillar);
    const avgScore = rows.length ? Math.round(rows.reduce((sum, post) => sum + post.score, 0) / rows.length) : 0;
    return { pillar, count: rows.length, avgScore, perfect: rows.filter((post) => post.score === 100).length };
  });
  const bands: ScoreBand = { perfect: 0, below: 0, perfectApproved: 0, belowApproved: 0 };
  for (const post of posts) {
    if (post.score === 100) {
      bands.perfect += 1;
      if (post.status === "approved") bands.perfectApproved += 1;
    } else {
      bands.below += 1;
      if (post.status === "approved") bands.belowApproved += 1;
    }
  }
  const avgScore = posts.length ? Math.round(posts.reduce((sum, post) => sum + post.score, 0) / posts.length) : 0;
  return { pillars, bands, avgScore, total: posts.length, approved: posts.filter((post) => post.status === "approved").length };
}

/** Hours already on the calendar. Not audience behavior — that arrives only after a network is connected. */
export function plannedHours(posts: { channel: Channel; scheduledFor: string }[]): { channel: Channel; hour: number; count: number }[] {
  const map = new Map<string, { channel: Channel; hour: number; count: number }>();
  for (const post of posts) {
    const hour = zoneParts(post.scheduledFor).hour;
    const key = `${post.channel}-${hour}`;
    const row = map.get(key) ?? { channel: post.channel, hour, count: 0 };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.hour - b.hour).slice(0, 6);
}

/** Posts per channel, split by pillar. Counts of planned posts, not results. */
export function channelPillarMatrix(posts: { channel: Channel; pillar: Pillar }[]) {
  return CHANNEL_ORDER.map((channel) => {
    const rows = posts.filter((post) => post.channel === channel);
    const byPillar = Object.fromEntries(PILLARS.map((pillar) => [pillar, rows.filter((post) => post.pillar === pillar).length])) as Record<Pillar, number>;
    return { channel, total: rows.length, byPillar };
  });
}

/** How many posts fall in each readiness band (under 60, 60-84, 85-99, 100). */
export function readinessBins(scores: number[]) {
  return READINESS_BANDS.map((band) => ({ label: band.label, color: band.color, count: scores.filter((score) => score >= band.min && score <= band.max).length }));
}

/**
 * Cumulative stage counts: every post is drafted, a post counts as "sent to review" once it has been there
 * (in review, sent back, approved or published), and so on. Statuses are the only evidence used.
 */
export function statusFunnel(statuses: PostStatus[]) {
  const n = (set: PostStatus[]) => statuses.filter((status) => set.includes(status)).length;
  return [
    { label: "Drafted", value: statuses.length },
    { label: "Sent to review", value: n(["needs_review", "changes", "approved", "published"]) },
    { label: "Approved", value: n(["approved", "published"]) },
    { label: "Published", value: n(["published"]) },
  ];
}

/** Posts planned on each of the next `days` desk-zone days, starting today. */
export function plannedPerDay(posts: { scheduledFor: string }[], days: number, now = new Date()): { key: string; count: number }[] {
  const start = dayKey(now);
  const counts = new Map<string, number>();
  for (const post of posts) counts.set(dayKey(post.scheduledFor), (counts.get(dayKey(post.scheduledFor)) ?? 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const key = addDaysKey(start, index);
    return { key, count: counts.get(key) ?? 0 };
  });
}
