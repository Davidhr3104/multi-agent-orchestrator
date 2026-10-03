import { channelLabel, PILLAR_LABEL } from "./format";
import { addZonedDays, DESK_TZ, DESK_TZ_LABEL, startOfZonedDay, zoneParts } from "./tz";
import type { Channel, Pillar } from "./types";

/**
 * Guideline hours, not this account's analytics. Weekday mornings for LinkedIn, later for TikTok,
 * midday for feeds. The desk never claims these came from the brand's own results. All hours are
 * wall-clock hours in the desk zone (see lib/tz.ts), so server and browser always agree.
 */
const HOUR: Record<Channel, Record<Pillar, number>> = {
  instagram: { product: 11, behind_the_scenes: 10, education: 12, community: 19, promo: 13 },
  linkedin: { product: 9, behind_the_scenes: 8, education: 8, community: 12, promo: 10 },
  x: { product: 9, behind_the_scenes: 12, education: 12, community: 17, promo: 9 },
  tiktok: { product: 19, behind_the_scenes: 18, education: 19, community: 21, promo: 19 },
  facebook: { product: 13, behind_the_scenes: 10, education: 11, community: 13, promo: 12 },
};

export type SlotSuggestion = { iso: string; reason: string; hour: number };

export function suggestSlot(channel: Channel, pillar: Pillar, now = new Date()): SlotSuggestion {
  const hour = HOUR[channel][pillar];
  let slot = addZonedDays(startOfZonedDay(now), 0, hour);
  if (slot.getTime() <= now.getTime() + 60 * 60 * 1000) slot = addZonedDays(slot, 1);
  if (channel === "linkedin") {
    while (zoneParts(slot).dow === 0 || zoneParts(slot).dow === 6) slot = addZonedDays(slot, 1);
  }
  const when = `${slot.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: DESK_TZ })} ${DESK_TZ_LABEL}`;
  const habit = `${hour % 12 || 12}${hour < 12 ? "am" : "pm"} ${DESK_TZ_LABEL}`;
  const reason =
    channel === "linkedin"
      ? `${channelLabel(channel)} ${PILLAR_LABEL[pillar].toLowerCase()} posts are usually read on weekday mornings. Guideline slot: ${when}. This is a publishing habit, not this account's analytics.`
      : `${channelLabel(channel)} ${PILLAR_LABEL[pillar].toLowerCase()} posts are often scheduled around ${habit}. Guideline slot: ${when}. This is a publishing habit, not this account's analytics.`;
  return { iso: slot.toISOString(), reason, hour };
}

/** Hour window per channel from the guideline table. Not this audience's history. */
export function channelWindows(): { channel: Channel; from: number; to: number }[] {
  return (Object.keys(HOUR) as Channel[]).map((channel) => {
    const hours = Object.values(HOUR[channel]);
    return { channel, from: Math.min(...hours), to: Math.max(...hours) };
  });
}

export function sameSlot(scheduledFor: string, suggestion: SlotSuggestion): boolean {
  const a = zoneParts(scheduledFor);
  const b = zoneParts(suggestion.iso);
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour;
}
