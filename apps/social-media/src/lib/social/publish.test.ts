import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { linkedInConfig } from "./config";
import { escapeLittleText, linkedInPostPayload, publishLinkedIn } from "./linkedin";
import { publishEnv, publishGate } from "./publish";
import { json, mockFetch, saveEnv } from "./test-helpers";
import { getPost, publishApprovedPost, PublishError, putPost } from "../store";
import type { Post } from "../types";

let restore: () => void;
beforeEach(() => {
  restore = saveEnv();
  process.env.HELIX_DESK_SEED = "off";
  delete (globalThis as { __helixSocialDesk?: unknown }).__helixSocialDesk;
});
afterEach(() => restore());

function post(patch: Partial<Post> = {}): Post {
  return {
    id: "p-1",
    channel: "facebook",
    pillar: "education",
    scheduledFor: "2026-10-05T15:00:00.000Z",
    caption: "How we roast in small batches.",
    hashtags: ["coffee"],
    asset: "Roaster photo",
    status: "approved",
    createdBy: "team",
    notes: [],
    approvedBy: "Marta",
    approvedAt: "2026-10-02T12:00:00.000Z",
    ...patch,
  };
}

describe("publish gate", () => {
  it("blocks a post nobody approved", () => {
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    process.env.HELIX_META_ACCESS_TOKEN = "t";
    process.env.HELIX_META_PAGE_ID = "555";
    const gate = publishGate(post({ status: "needs_review", approvedBy: undefined, approvedAt: undefined }), publishEnv("live"));
    expect(gate).toEqual({ allowed: false, reason: "Only a post a person approved can be published." });
  });

  it("blocks without the live switch", () => {
    process.env.HELIX_META_ACCESS_TOKEN = "t";
    process.env.HELIX_META_PAGE_ID = "555";
    expect(publishGate(post(), publishEnv("live"))).toMatchObject({ allowed: false, reason: expect.stringMatching(/HELIX_SOCIAL_PUBLISH=live/) });
  });

  it("never publishes from the demo desk, and X and TikTok stay token-only", () => {
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    expect(publishGate(post(), publishEnv("demo"))).toMatchObject({ allowed: false, reason: expect.stringMatching(/demo desk/) });
    expect(publishGate(post({ channel: "x" }), publishEnv("live"))).toMatchObject({ allowed: false, reason: expect.stringMatching(/token-only/) });
    expect(publishGate(post({ channel: "tiktok" }), publishEnv("live"))).toMatchObject({ allowed: false, reason: expect.stringMatching(/token-only/) });
  });

  it("blocks a second publish", () => {
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    process.env.HELIX_META_ACCESS_TOKEN = "t";
    process.env.HELIX_META_PAGE_ID = "555";
    const done = post({ status: "published", publication: { network: "facebook", externalId: "1", permalink: null, at: "x", by: "y" } });
    expect(publishGate(done, publishEnv("live"))).toMatchObject({ allowed: false, reason: expect.stringMatching(/already published/) });
  });
});

describe("publishApprovedPost (store)", () => {
  beforeEach(() => {
    process.env.HELIX_META_ACCESS_TOKEN = "t";
    process.env.HELIX_META_PAGE_ID = "555";
  });

  it("makes no network call without the live switch", async () => {
    await putPost(post());
    const { fetch, calls } = mockFetch();
    await expect(publishApprovedPost("p-1", "You", { fetchImpl: fetch })).rejects.toBeInstanceOf(PublishError);
    expect(calls).toHaveLength(0);
    expect((await getPost("p-1"))?.status).toBe("approved");
  });

  it("makes no network call for an unapproved post, even when live", async () => {
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    await putPost(post({ status: "needs_review", approvedBy: undefined, approvedAt: undefined }));
    const { fetch, calls } = mockFetch();
    await expect(publishApprovedPost("p-1", "You", { fetchImpl: fetch })).rejects.toThrow(/approved/);
    expect(calls).toHaveLength(0);
  });

  it("records the real post id and permalink only after the API answers", async () => {
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    await putPost(post());
    const { fetch } = mockFetch(
      (c) => (c.method === "POST" && c.url.endsWith("/555/feed") ? json({ id: "555_9" }) : undefined),
      (c) => (c.url.includes("/555_9?") ? json({ permalink_url: "https://facebook.com/555/posts/9" }) : undefined)
    );
    const published = await publishApprovedPost("p-1", "You", { fetchImpl: fetch });
    expect(published?.status).toBe("published");
    expect(published?.publication).toMatchObject({ network: "facebook", externalId: "555_9", permalink: "https://facebook.com/555/posts/9", by: "You" });
  });

  it("keeps the post approved when the network refuses", async () => {
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    await putPost(post());
    const { fetch } = mockFetch(() => json({ error: { message: "Permissions error" } }, 403));
    await expect(publishApprovedPost("p-1", "You", { fetchImpl: fetch })).rejects.toThrow(/Permissions error/);
    const after = await getPost("p-1");
    expect(after?.status).toBe("approved");
    expect(after?.publication).toBeUndefined();
  });
});

describe("LinkedIn Posts API", () => {
  beforeEach(() => {
    process.env.HELIX_LINKEDIN_ACCESS_TOKEN = "li-token";
    process.env.HELIX_LINKEDIN_ORGANIZATION_URN = "12345";
  });

  it("builds an organization post payload with escaped commentary and hashtags", () => {
    const payload = linkedInPostPayload(linkedInConfig()!, { caption: "Roasting (small) batches @ home", hashtags: ["coffee"] });
    expect(payload).toEqual({
      author: "urn:li:organization:12345",
      commentary: "Roasting \\(small\\) batches \\@ home\n\n{hashtag|\\#|coffee}",
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    });
    expect(escapeLittleText("a_b*c")).toBe("a\\_b\\*c");
  });

  it("sends the LinkedIn-Version header and reads the post URN from x-restli-id", async () => {
    const { fetch, calls } = mockFetch((c) => (c.url === "https://api.linkedin.com/rest/posts" ? new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:999" } }) : undefined));
    const result = await publishLinkedIn(linkedInConfig()!, { caption: "Hi", hashtags: [], media: [] }, fetch);
    expect(result).toEqual({ externalId: "urn:li:share:999", permalink: "https://www.linkedin.com/feed/update/urn:li:share:999/" });
    expect(calls[0].headers["linkedin-version"]).toMatch(/^\d{6}$/);
    expect(calls[0].headers["x-restli-protocol-version"]).toBe("2.0.0");
    expect(calls[0].headers.authorization).toBe("Bearer li-token");
    expect(JSON.parse(calls[0].body).author).toBe("urn:li:organization:12345");
  });

  it("is not configured without an organization URN", () => {
    delete process.env.HELIX_LINKEDIN_ORGANIZATION_URN;
    expect(linkedInConfig()).toBeNull();
  });
});
