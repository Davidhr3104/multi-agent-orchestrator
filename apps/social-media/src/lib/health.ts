import type { Pillar } from "./types";

const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

function dayKey(iso: string) {
  const day = new Date(iso);
  return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
}

/** The next three local days that have no planned post. Not a news scan. */
export function openSlots(posts: { scheduledFor: string }[], now = new Date()): string[] {
  const taken = new Set(posts.map((post) => dayKey(post.scheduledFor)));
  const open: string[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    if (!taken.has(key)) {
      open.push(day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    }
  }
  return open;
}

export function scoreHealth(posts: { pillar: Pillar; score: number; scheduledFor: string }[], now = new Date()) {
  const month = posts.filter((post) => {
    const day = new Date(post.scheduledFor);
    return day.getMonth() === now.getMonth() && day.getFullYear() === now.getFullYear();
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
