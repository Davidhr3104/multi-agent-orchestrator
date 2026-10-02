import { CHANNEL_RULES } from "./readiness";
import type { Channel, Pillar, Post, PostStatus } from "./types";

export const channelLabel = (c: Channel) => CHANNEL_RULES[c].label;

export const PILLAR_LABEL: Record<Pillar, string> = {
  product: "Product",
  behind_the_scenes: "Behind the scenes",
  education: "Education",
  community: "Community",
  promo: "Promo",
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  changes: "Changes requested",
  approved: "Approved",
  published: "Published",
};

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Posts scheduled before now + `days` (the seed only plans forward, so this is "the next N days"). */
export function withinDays<T extends Pick<Post, "scheduledFor">>(posts: T[], days: number, now = Date.now()): T[] {
  return posts.filter((p) => Date.parse(p.scheduledFor) - now < days * 86_400_000);
}

export function snippet(text: string, n = 48): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

/** Short human name for a post: "Instagram · Wed, Oct 1 — Our Huila harvest lot…" */
export function postLabel(p: Pick<Post, "channel" | "scheduledFor" | "caption">): string {
  return `${channelLabel(p.channel)} · ${formatDay(p.scheduledFor)} — ${snippet(p.caption, 32)}`;
}
