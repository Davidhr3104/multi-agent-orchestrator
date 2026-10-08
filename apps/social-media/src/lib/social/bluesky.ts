import { NetworkError, scrub, type FetchLike } from "./config";
import type { PublishInput, PublishResult } from "./meta-publish";

export type BlueskyConfig = { identifier: string; appPassword: string; service: string };

type Session = { did: string; accessJwt: string };

export function blueskyPostText(input: Pick<PublishInput, "caption" | "hashtags">): string {
  const tags = input.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const text = tags ? `${input.caption.trim()}\n\n${tags}` : input.caption.trim();
  return text.slice(0, 300);
}

async function createSession(cfg: BlueskyConfig, fetchImpl: FetchLike): Promise<Session> {
  const res = await fetchImpl(`${cfg.service}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: cfg.identifier, password: cfg.appPassword }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new NetworkError(scrub(body?.message ?? `Bluesky session failed (${res.status})`), res.status);
  }
  const data = (await res.json()) as { did?: string; accessJwt?: string };
  if (!data.did || !data.accessJwt) throw new NetworkError("Bluesky session returned no credentials.");
  return { did: data.did, accessJwt: data.accessJwt };
}

/** Text post via AT Protocol. Images are not uploaded in this adapter yet. */
export async function publishBluesky(cfg: BlueskyConfig, input: PublishInput, fetchImpl: FetchLike): Promise<PublishResult> {
  if (input.media.length) throw new NetworkError("Bluesky image upload is not built yet. Remove the file or post it by hand.");
  const session = await createSession(cfg, fetchImpl);
  const text = blueskyPostText(input);
  const createdAt = new Date().toISOString();
  const res = await fetchImpl(`${cfg.service}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: { $type: "app.bsky.feed.post", text, createdAt },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new NetworkError(scrub(body?.message ?? `Bluesky publish failed (${res.status})`), res.status);
  }
  const data = (await res.json()) as { uri?: string; cid?: string };
  if (!data.uri) throw new NetworkError("Bluesky accepted the request but returned no post URI.");
  const handle = cfg.identifier.replace(/^@/, "");
  const rkey = data.uri.split("/").pop() ?? "";
  return { externalId: data.uri, permalink: `https://bsky.app/profile/${handle}/post/${rkey}` };
}
