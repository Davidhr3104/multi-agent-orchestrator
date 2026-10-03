import { stockForPillar } from "./stock";
import type { Channel, MediaItem, Pillar, Post, PostStatus } from "./types";

/** One colour per content pillar, used by every chart and cover so a pillar reads the same everywhere. */
export const PILLAR_ORDER: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

export const PILLAR_COLOR: Record<Pillar, string> = {
  product: "#34d399",
  behind_the_scenes: "#38bdf8",
  education: "#fbbf24",
  community: "#fb7185",
  promo: "#a78bfa",
};

/** Two-stop gradients for the generated cover when there is no photo. */
export const PILLAR_GRADIENT: Record<Pillar, readonly [string, string]> = {
  product: ["#064e3b", "#0f766e"],
  behind_the_scenes: ["#0c4a6e", "#3730a3"],
  education: ["#78350f", "#b45309"],
  community: ["#881337", "#be185d"],
  promo: ["#4c1d95", "#7e22ce"],
};

export const CHANNEL_ORDER: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];

export const CHANNEL_COLOR: Record<Channel, string> = {
  instagram: "#f472b6",
  linkedin: "#38bdf8",
  x: "#cbd5e1",
  tiktok: "#2dd4bf",
  facebook: "#60a5fa",
};

export const STATUS_ORDER: PostStatus[] = ["draft", "needs_review", "changes", "approved", "published"];

export const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "#94a3b8",
  needs_review: "#fbbf24",
  changes: "#fb7185",
  approved: "#34d399",
  published: "#a78bfa",
};

/** Same score bands the readiness histogram uses. */
export const READINESS_BANDS = [
  { label: "Under 60", min: 0, max: 59, color: "#fb7185" },
  { label: "60 to 84", min: 60, max: 84, color: "#fbbf24" },
  { label: "85 to 99", min: 85, max: 99, color: "#38bdf8" },
  { label: "100", min: 100, max: 100, color: "#34d399" },
] as const;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A stock photo for a post that has no media of its own. It is a stand-in, never the post's real image:
 * every place that shows it labels it "Sample image", and it does not count as attached media for readiness.
 */
export function sampleMedia(post: Pick<Post, "id" | "pillar">): MediaItem {
  const frames = stockForPillar(post.pillar);
  const frame = frames[hash(post.id) % frames.length];
  return { id: `sample-${post.id}`, kind: "image", label: frame.label, url: frame.url, source: "stock" };
}

export function coverMedia(post: Pick<Post, "media">): MediaItem | undefined {
  return post.media?.find((item) => item.kind === "image") ?? post.media?.[0];
}
