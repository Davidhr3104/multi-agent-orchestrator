import { PILLAR_LABEL } from "./format";
import type { Pillar, Post } from "./types";
import { startOfZonedDay } from "./tz";

const DAY = 86_400_000;
const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

export type PillarGap = {
  pillar: Pillar;
  /** Days from today until the next post of this pillar, when there is one inside the horizon. */
  daysUntil: number | null;
  /** Day offset where the hole starts, when the pillar is present soon and then disappears. */
  holeAfter: number | null;
  holeUntil: number | null;
};

/**
 * A pillar is flagged when it has no post in the next 4 days, or when a later stretch of 4+ days
 * inside the planning window has none. Counts planned posts, not published performance.
 */
export function pillarGaps(posts: Pick<Post, "pillar" | "scheduledFor">[], now = new Date(), horizonDays = 21, gapDays = 4): PillarGap[] {
  const start = startOfZonedDay(now);
  const gaps: PillarGap[] = [];

  for (const pillar of PILLARS) {
    const days = [...new Set(
      posts
        .filter((p) => p.pillar === pillar)
        .map((p) => Math.floor((Date.parse(p.scheduledFor) - start.getTime()) / DAY))
        .filter((d) => d >= 0 && d <= horizonDays)
    )].sort((a, b) => a - b);

    if (days.length === 0 || days[0] >= gapDays) {
      gaps.push({ pillar, daysUntil: days[0] ?? null, holeAfter: null, holeUntil: null });
      continue;
    }

    let prev = days[0];
    for (const day of days.slice(1)) {
      if (day - prev >= gapDays) {
        gaps.push({ pillar, daysUntil: days[0], holeAfter: prev, holeUntil: day });
        break;
      }
      prev = day;
    }
  }

  return gaps;
}

export function gapMessage(gap: PillarGap): string {
  const name = PILLAR_LABEL[gap.pillar];
  if (gap.holeAfter !== null && gap.holeUntil !== null) {
    return `${name} shows up, then goes quiet for ${gap.holeUntil - gap.holeAfter} days. The next one after that is ${gap.holeUntil} days out.`;
  }
  if (gap.daysUntil === null) return `${name} has no post in the next 21 days.`;
  return `${name} has no post for the next ${gap.daysUntil} days.`;
}
