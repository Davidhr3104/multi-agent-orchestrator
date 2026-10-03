import type { MediaItem } from "../types";
import { NetworkError, scrub, type FetchLike, type MetaConfig } from "./config";

export type PublishInput = { caption: string; hashtags: string[]; media: MediaItem[] };

/** What the network answered after a successful post. */
export type PublishResult = { externalId: string; permalink: string | null };

export type PollOptions = { sleep?: (ms: number) => Promise<void>; maxPolls?: number; intervalMs?: number };

export function fullCaption(input: Pick<PublishInput, "caption" | "hashtags">): string {
  const tags = input.hashtags.map((tag) => `#${tag}`).join(" ");
  return tags ? `${input.caption.trim()}\n\n${tags}` : input.caption.trim();
}

async function graphCall<T>(cfg: MetaConfig, method: "GET" | "POST", path: string, params: Record<string, string>, token: string, fetchImpl: FetchLike): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const base = `https://graph.facebook.com/${cfg.graphVersion}/${path}`;
  const res = await fetchImpl(method === "GET" ? `${base}${query ? `?${query}` : ""}` : base, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? query : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !body || body.error) throw new NetworkError(scrub(body?.error?.message ?? `Graph API answered ${res.status}`), res.status);
  return body;
}

function singleMedia(input: PublishInput, network: string): MediaItem | null {
  if (input.media.length > 1) throw new NetworkError(`${network} carousel publishing is not built yet. Keep one file on this post or post it by hand.`);
  return input.media[0] ?? null;
}

/** Instagram Content Publishing: create a container, wait until it is ready, then publish it. */
export async function publishInstagram(cfg: MetaConfig, input: PublishInput, fetchImpl: FetchLike, poll: PollOptions = {}): Promise<PublishResult> {
  if (!cfg.igUserId) throw new NetworkError("HELIX_META_IG_USER_ID is not set.");
  const media = singleMedia(input, "Instagram");
  if (!media) throw new NetworkError("Instagram needs an image or a video. Attach one before publishing.");
  const params: Record<string, string> = { caption: fullCaption(input) };
  if (media.kind === "video") {
    params.media_type = "REELS";
    params.video_url = media.url;
  } else {
    params.image_url = media.url;
  }
  const container = await graphCall<{ id: string }>(cfg, "POST", `${cfg.igUserId}/media`, params, cfg.token, fetchImpl);
  if (!container.id) throw new NetworkError("Instagram did not return a container id.");

  const sleep = poll.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxPolls = poll.maxPolls ?? 10;
  for (let attempt = 0; ; attempt += 1) {
    const status = await graphCall<{ status_code?: string }>(cfg, "GET", container.id, { fields: "status_code" }, cfg.token, fetchImpl);
    if (status.status_code === "FINISHED" || status.status_code === undefined) break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new NetworkError(`Instagram rejected the media (${status.status_code}).`);
    if (attempt + 1 >= maxPolls) throw new NetworkError("Instagram is still processing the media. Nothing was published; try again in a minute.");
    await sleep(poll.intervalMs ?? 3000);
  }

  const published = await graphCall<{ id: string }>(cfg, "POST", `${cfg.igUserId}/media_publish`, { creation_id: container.id }, cfg.token, fetchImpl);
  if (!published.id) throw new NetworkError("Instagram did not return a media id.");
  let permalink: string | null = null;
  try {
    permalink = (await graphCall<{ permalink?: string }>(cfg, "GET", published.id, { fields: "permalink" }, cfg.token, fetchImpl)).permalink ?? null;
  } catch {
    permalink = null;
  }
  return { externalId: published.id, permalink };
}

/** Facebook Page post: /photos for a single image, /feed for text. */
export async function publishFacebook(cfg: MetaConfig, input: PublishInput, fetchImpl: FetchLike): Promise<PublishResult> {
  if (!cfg.pageId) throw new NetworkError("HELIX_META_PAGE_ID is not set.");
  const media = singleMedia(input, "Facebook");
  if (media?.kind === "video") throw new NetworkError("Facebook video publishing is not built yet. Post the video by hand.");
  const message = fullCaption(input);
  let externalId: string;
  if (media) {
    const photo = await graphCall<{ id: string; post_id?: string }>(cfg, "POST", `${cfg.pageId}/photos`, { url: media.url, caption: message }, cfg.pageToken, fetchImpl);
    externalId = photo.post_id ?? photo.id;
  } else {
    externalId = (await graphCall<{ id: string }>(cfg, "POST", `${cfg.pageId}/feed`, { message }, cfg.pageToken, fetchImpl)).id;
  }
  if (!externalId) throw new NetworkError("Facebook did not return a post id.");
  let permalink: string | null = null;
  try {
    permalink = (await graphCall<{ permalink_url?: string }>(cfg, "GET", externalId, { fields: "permalink_url" }, cfg.pageToken, fetchImpl)).permalink_url ?? null;
  } catch {
    permalink = null;
  }
  return { externalId, permalink };
}
