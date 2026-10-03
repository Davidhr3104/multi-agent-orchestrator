import { NetworkError, scrub, type FetchLike, type LinkedInConfig } from "./config";
import type { PublishInput, PublishResult } from "./meta-publish";

/** Characters LinkedIn's "little text" commentary format treats as markup. */
const RESERVED = /[\\|{}@[\]()<>#*_~]/g;

export function escapeLittleText(text: string): string {
  return text.replace(RESERVED, (ch) => `\\${ch}`);
}

export function linkedInCommentary(input: Pick<PublishInput, "caption" | "hashtags">): string {
  const body = escapeLittleText(input.caption.trim());
  const tags = input.hashtags.map((tag) => `{hashtag|\\#|${escapeLittleText(tag)}}`).join(" ");
  return tags ? `${body}\n\n${tags}` : body;
}

export function linkedInPostPayload(cfg: LinkedInConfig, input: Pick<PublishInput, "caption" | "hashtags">) {
  return {
    author: cfg.organizationUrn,
    commentary: linkedInCommentary(input),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

/** Text post as the organization through the Posts API. The post URN comes back in the x-restli-id header. */
export async function publishLinkedIn(cfg: LinkedInConfig, input: PublishInput, fetchImpl: FetchLike): Promise<PublishResult> {
  if (input.media.length) throw new NetworkError("LinkedIn image upload is not built yet. Remove the file or post it by hand.");
  const res = await fetchImpl("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.token}`,
      "content-type": "application/json",
      "LinkedIn-Version": cfg.version,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(linkedInPostPayload(cfg, input)),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new NetworkError(scrub(body?.message ?? `LinkedIn answered ${res.status}`), res.status);
  }
  const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
  if (!urn) throw new NetworkError("LinkedIn accepted the request but returned no post id.");
  return { externalId: urn, permalink: `https://www.linkedin.com/feed/update/${urn}/` };
}
