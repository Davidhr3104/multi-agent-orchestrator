import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { metaConfig } from "./config";
import { insightValue, mapFbPost, mapIgMedia, readInstagram, verifyMetaToken } from "./meta-graph";
import { publishFacebook, publishInstagram } from "./meta-publish";
import { json, mockFetch, saveEnv } from "./test-helpers";

let restore: () => void;
beforeEach(() => {
  restore = saveEnv();
  process.env.HELIX_META_ACCESS_TOKEN = "test-token";
  process.env.HELIX_META_IG_USER_ID = "1784";
  process.env.HELIX_META_PAGE_ID = "555";
});
afterEach(() => restore());

describe("Graph mapping", () => {
  it("maps Instagram media and insights, keeping missing metrics null", () => {
    const post = mapIgMedia(
      { id: "m1", caption: "Harvest drop", media_type: "IMAGE", permalink: "https://instagram.com/p/x", timestamp: "2026-09-28T10:00:00+0000", like_count: 40, comments_count: 5 },
      [
        { name: "reach", values: [{ value: 1000 }] },
        { name: "saved", values: [{ value: 7 }] },
        { name: "shares", total_value: { value: 3 } },
      ]
    );
    expect(post).toMatchObject({ network: "instagram", id: "m1", likes: 40, comments: 5, reach: 1000, saves: 7, shares: 3, views: null, publishedAt: "2026-09-28T10:00:00.000Z" });
  });

  it("marks reels and maps Facebook posts", () => {
    expect(mapIgMedia({ id: "r", media_type: "VIDEO", media_product_type: "REELS" }, undefined).mediaType).toBe("REELS");
    const fb = mapFbPost(
      { id: "555_1", message: "Hi", created_time: "2026-09-29T09:00:00+0000", permalink_url: "https://facebook.com/1", reactions: { summary: { total_count: 12 } }, comments: { summary: { total_count: 2 } } },
      [{ name: "post_impressions_unique", values: [{ value: 300 }] }]
    );
    expect(fb).toMatchObject({ network: "facebook", likes: 12, comments: 2, shares: 0, reach: 300, saves: null });
  });

  it("sums period values when there is no total", () => {
    expect(insightValue([{ name: "reach", values: [{ value: 2 }, { value: 3 }] }], "reach")).toBe(5);
    expect(insightValue([], "reach")).toBeNull();
  });

  it("reads an Instagram account through the Graph API with a bearer header", async () => {
    const { fetch, calls } = mockFetch(
      (c) => (c.url.includes("/1784/media?") ? json({ data: [{ id: "m1", caption: "A", like_count: 3, comments_count: 1, timestamp: "2026-09-30T00:00:00Z" }] }) : undefined),
      (c) => (c.url.includes("/m1/insights") ? json({ data: [{ name: "reach", values: [{ value: 50 }] }] }) : undefined),
      (c) => (c.url.includes("/1784/insights") ? json({ data: [{ name: "reach", total_value: { value: 900 } }] }) : undefined),
      (c) => (c.url.includes("/1784?") ? json({ id: "1784", username: "lumen", followers_count: 1200 }) : undefined)
    );
    const read = await readInstagram(metaConfig()!, fetch, new Date("2026-10-02T00:00:00Z"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.account).toMatchObject({ name: "@lumen", followers: 1200, reach: 900 });
    expect(read.posts[0]).toMatchObject({ id: "m1", reach: 50, likes: 3 });
    expect(calls.every((c) => c.headers.authorization === "Bearer test-token" && !c.url.includes("access_token="))).toBe(true);
  });

  it("reports a Graph error without leaking the token", async () => {
    const { fetch } = mockFetch(() => json({ error: { message: "Invalid OAuth access token EAAB1234567890abcdefghijklmnop" } }, 400));
    const result = await verifyMetaToken(metaConfig()!, fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("EAAB1234567890");
  });

  it("flags an expired token from debug_token", async () => {
    const { fetch } = mockFetch(() => json({ data: { is_valid: true, expires_at: 1_700_000_000, scopes: ["instagram_basic"] } }));
    const result = await verifyMetaToken(metaConfig()!, fetch, new Date("2026-10-02T00:00:00Z"));
    expect(result).toMatchObject({ ok: false, expired: true });
  });
});

describe("Instagram two-step publish", () => {
  it("creates a container, waits until FINISHED, publishes it and records the permalink", async () => {
    let polls = 0;
    const { fetch, calls } = mockFetch(
      (c) => (c.method === "POST" && c.url.endsWith("/1784/media") ? json({ id: "container-1" }) : undefined),
      (c) => (c.url.includes("/container-1?") ? json({ status_code: ++polls < 2 ? "IN_PROGRESS" : "FINISHED" }) : undefined),
      (c) => (c.method === "POST" && c.url.endsWith("/1784/media_publish") ? json({ id: "media-9" }) : undefined),
      (c) => (c.url.includes("/media-9?") ? json({ permalink: "https://instagram.com/p/abc" }) : undefined)
    );
    const result = await publishInstagram(
      metaConfig()!,
      { caption: "New harvest", hashtags: ["coffee"], media: [{ id: "a", kind: "image", label: "x", url: "https://cdn.example.com/a.jpg", source: "upload" }] },
      fetch,
      { sleep: async () => {} }
    );
    expect(result).toEqual({ externalId: "media-9", permalink: "https://instagram.com/p/abc" });
    const create = new URLSearchParams(calls[0].body);
    expect(create.get("image_url")).toBe("https://cdn.example.com/a.jpg");
    expect(create.get("caption")).toBe("New harvest\n\n#coffee");
    const publish = calls.find((c) => c.url.endsWith("/media_publish"))!;
    expect(new URLSearchParams(publish.body).get("creation_id")).toBe("container-1");
    expect(polls).toBe(2);
  });

  it("does not publish when the container fails", async () => {
    const { fetch, calls } = mockFetch(
      (c) => (c.method === "POST" && c.url.endsWith("/1784/media") ? json({ id: "c2" }) : undefined),
      (c) => (c.url.includes("/c2?") ? json({ status_code: "ERROR" }) : undefined)
    );
    await expect(
      publishInstagram(metaConfig()!, { caption: "x", hashtags: [], media: [{ id: "a", kind: "image", label: "x", url: "https://cdn.example.com/a.jpg", source: "upload" }] }, fetch, { sleep: async () => {} })
    ).rejects.toThrow(/rejected the media/);
    expect(calls.some((c) => c.url.endsWith("/media_publish"))).toBe(false);
  });

  it("refuses a post with no media", async () => {
    const { fetch, calls } = mockFetch();
    await expect(publishInstagram(metaConfig()!, { caption: "x", hashtags: [], media: [] }, fetch)).rejects.toThrow(/needs an image/);
    expect(calls).toHaveLength(0);
  });
});

describe("Facebook Page publish", () => {
  it("posts text to /feed with the page token", async () => {
    process.env.HELIX_META_PAGE_ACCESS_TOKEN = "page-token";
    const { fetch, calls } = mockFetch(
      (c) => (c.method === "POST" && c.url.endsWith("/555/feed") ? json({ id: "555_77" }) : undefined),
      (c) => (c.url.includes("/555_77?") ? json({ permalink_url: "https://facebook.com/555/posts/77" }) : undefined)
    );
    const result = await publishFacebook(metaConfig()!, { caption: "Hello", hashtags: [], media: [] }, fetch);
    expect(result).toEqual({ externalId: "555_77", permalink: "https://facebook.com/555/posts/77" });
    expect(calls[0].headers.authorization).toBe("Bearer page-token");
    expect(new URLSearchParams(calls[0].body).get("message")).toBe("Hello");
  });
});
