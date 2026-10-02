import type { Channel, Pillar, PostStatus } from "./types";

export type ScoreBand = { perfect: number; below: number; perfectApproved: number; belowApproved: number };

const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

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
    const hour = new Date(post.scheduledFor).getHours();
    const key = `${post.channel}-${hour}`;
    const row = map.get(key) ?? { channel: post.channel, hour, count: 0 };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.hour - b.hour).slice(0, 6);
}
