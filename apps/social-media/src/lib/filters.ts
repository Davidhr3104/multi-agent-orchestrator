import type { Channel, Pillar, Post, PostStatus } from "./types";

export const FILTER_CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];
export const FILTER_PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];
export const FILTER_STATUSES: PostStatus[] = ["draft", "needs_review", "changes", "approved"];

export type CalendarFilter = { channel: Channel | null; pillar: Pillar | null; status: PostStatus | null };

export function readCalendarFilter(sp: { channel?: string; pillar?: string; status?: string }): CalendarFilter {
  return {
    channel: FILTER_CHANNELS.includes(sp.channel as Channel) ? (sp.channel as Channel) : null,
    pillar: FILTER_PILLARS.includes(sp.pillar as Pillar) ? (sp.pillar as Pillar) : null,
    status: FILTER_STATUSES.includes(sp.status as PostStatus) ? (sp.status as PostStatus) : null,
  };
}

export function matchesFilter<T extends Pick<Post, "channel" | "pillar" | "status">>(post: T, filter: CalendarFilter): boolean {
  return (!filter.channel || post.channel === filter.channel) && (!filter.pillar || post.pillar === filter.pillar) && (!filter.status || post.status === filter.status);
}
