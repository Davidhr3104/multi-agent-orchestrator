import { channelLabel, PILLAR_LABEL } from "./format";
import type { Channel, Pillar } from "./types";

/**
 * Guideline hours, not this account's analytics. Weekday mornings for LinkedIn, later for TikTok,
 * midday for feeds. The desk never claims these came from the brand's own results.
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
  const slot = new Date(now);
  slot.setMinutes(0, 0, 0);
  slot.setHours(hour);
  if (slot.getTime() <= now.getTime() + 60 * 60 * 1000) slot.setDate(slot.getDate() + 1);
  if (channel === "linkedin") {
    while (slot.getDay() === 0 || slot.getDay() === 6) slot.setDate(slot.getDate() + 1);
  }
  const when = slot.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric" });
  const reason =
    channel === "linkedin"
      ? `${channelLabel(channel)} ${PILLAR_LABEL[pillar].toLowerCase()} posts are usually read on weekday mornings. Guideline slot: ${when}. This is a publishing habit, not this account's analytics.`
      : `${channelLabel(channel)} ${PILLAR_LABEL[pillar].toLowerCase()} posts are often scheduled around ${hour % 12 || 12}${hour < 12 ? "am" : "pm"}. Guideline slot: ${when}. This is a publishing habit, not this account's analytics.`;
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
  const a = new Date(scheduledFor);
  const b = new Date(suggestion.iso);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() && a.getHours() === b.getHours();
}
