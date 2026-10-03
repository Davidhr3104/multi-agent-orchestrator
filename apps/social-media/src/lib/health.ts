import type { Pillar } from "./types";
import { addDaysKey, dayKey, formatKey } from "./tz";

const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

/** The next three local days that have no planned post. Not a news scan. */
export function openSlots(posts: { scheduledFor: string }[], now = new Date()): string[] {
  const taken = new Set(posts.map((post) => dayKey(post.scheduledFor)));
  const open: string[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const key = addDaysKey(dayKey(now), offset);
    if (!taken.has(key)) {
      open.push(formatKey(key, { weekday: "short", month: "short", day: "numeric" }));
    }
  }
  return open;
}

export function scoreHealth(posts: { pillar: Pillar; score: number; scheduledFor: string }[], now = new Date()) {
  const month = posts.filter((post) => {
    return dayKey(post.scheduledFor).slice(0, 7) === dayKey(now).slice(0, 7);
  });
  const rows = month.length ? month : posts;
  const avg = rows.length ? Math.round(rows.reduce((sum, post) => sum + post.score, 0) / rows.length) : 0;
  const weak = PILLARS.map((pillar) => {
    const group = rows.filter((post) => post.pillar === pillar);
    const pillarAvg = group.length ? Math.round(group.reduce((sum, post) => sum + post.score, 0) / group.length) : 0;
    return { pillar, count: group.length, avg: pillarAvg };
  }).filter((row) => row.count > 0 && row.avg < 90);
  return { avg, weak, total: rows.length, scope: month.length ? "this month" : "the planned calendar" };
}
