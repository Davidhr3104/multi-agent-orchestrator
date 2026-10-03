import type { DeskMode } from "@helix/core";
import type { Channel, Post } from "../types";
import { linkedInConfig, metaConfig, publishSwitchOn, type FetchLike, type LinkedInConfig, type MetaConfig } from "./config";
import { publishLinkedIn } from "./linkedin";
import { publishFacebook, publishInstagram, type PollOptions, type PublishResult } from "./meta-publish";

export type PublishEnv = { live: boolean; deskMode: DeskMode; meta: MetaConfig | null; linkedin: LinkedInConfig | null };

export type PublishGate = { allowed: true } | { allowed: false; reason: string };

export const TOKEN_ONLY: Channel[] = ["x", "tiktok"];

export function publishEnv(deskMode: DeskMode): PublishEnv {
  return { live: publishSwitchOn(), deskMode, meta: metaConfig(), linkedin: linkedInConfig() };
}

/** Every reason a post may not leave the desk. Publishing needs a person's approval on this exact post and the live switch. */
export function publishGate(post: Post, env: PublishEnv): PublishGate {
  if (env.deskMode === "demo") return { allowed: false, reason: "This is the demo desk. Sample posts never go to a real account." };
  if (post.publication || post.status === "published") return { allowed: false, reason: "This post was already published." };
  if (post.status !== "approved" || !post.approvedBy || !post.approvedAt) return { allowed: false, reason: "Only a post a person approved can be published." };
  if (TOKEN_ONLY.includes(post.channel)) return { allowed: false, reason: `${post.channel === "x" ? "X" : "TikTok"} is token-only in this build. There is no publishing adapter, so post it by hand.` };
  if (!env.live) return { allowed: false, reason: "Publishing is off. An operator has to set HELIX_SOCIAL_PUBLISH=live." };
  if (post.channel === "instagram") {
    if (!env.meta?.igUserId) return { allowed: false, reason: "Instagram needs HELIX_META_ACCESS_TOKEN and HELIX_META_IG_USER_ID." };
    if (!post.media?.length) return { allowed: false, reason: "Instagram needs an image or a video on the post." };
  }
  if (post.channel === "facebook" && !env.meta?.pageId) return { allowed: false, reason: "Facebook needs HELIX_META_ACCESS_TOKEN and HELIX_META_PAGE_ID." };
  if (post.channel === "linkedin" && !env.linkedin) return { allowed: false, reason: "LinkedIn needs HELIX_LINKEDIN_ACCESS_TOKEN and HELIX_LINKEDIN_ORGANIZATION_URN." };
  return { allowed: true };
}

/** Sends one post to its network. Callers must check publishGate first; this re-checks so it can't be skipped. */
export async function sendToNetwork(post: Post, env: PublishEnv, fetchImpl: FetchLike, poll?: PollOptions): Promise<PublishResult> {
  const gate = publishGate(post, env);
  if (!gate.allowed) throw new Error(gate.reason);
  const input = { caption: post.caption, hashtags: post.hashtags, media: post.media ?? [] };
  if (post.channel === "instagram" && env.meta) return publishInstagram(env.meta, input, fetchImpl, poll);
  if (post.channel === "facebook" && env.meta) return publishFacebook(env.meta, input, fetchImpl);
  if (post.channel === "linkedin" && env.linkedin) return publishLinkedIn(env.linkedin, input, fetchImpl);
  throw new Error("No publishing adapter for this channel.");
}
