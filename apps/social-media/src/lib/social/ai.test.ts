import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { draftsFromTopPosts } from "./ai-drafts";
import { aiUsageTotals, estimateUsd, resetAiLedger } from "./claude";
import type { InsightsSnapshot } from "./insights";
import type { RealPost } from "./meta-graph";
import { computeWeeklyMetrics, proseUsesOnlyFacts, rankPosts, topPosts, weeklyFacts } from "./performance";
import { json, mockFetch, saveEnv } from "./test-helpers";
import { writeWeeklyReport } from "./weekly-report";
import type { Brand } from "../types";

const NOW = new Date("2026-10-02T12:00:00Z");
const BRAND: Brand = { name: "Lumen", handle: "@lumen", voice: ["warm"], avoid: ["cheap"], directives: "", channels: ["instagram"] };

function real(id: string, patch: Partial<RealPost>): RealPost {
  return { network: "instagram", id, caption: `Caption ${id}`, mediaType: "IMAGE", permalink: `https://instagram.com/p/${id}`, publishedAt: "2026-09-30T10:00:00.000Z", likes: 0, comments: 0, saves: 0, shares: 0, reach: null, views: null, ...patch };
}

const POSTS = [
  real("a", { likes: 50, comments: 10, reach: 1000 }), // 6.0%
  real("b", { likes: 30, saves: 20, reach: 500 }), // 10.0%
  real("c", { likes: 90, reach: null }),
  real("old", { likes: 5, reach: 100, publishedAt: "2026-09-20T10:00:00.000Z" }),
];

function claudeReply(text: string, usage = { input_tokens: 1000, output_tokens: 200 }) {
  return mockFetch((c) => (c.url === "https://api.anthropic.com/v1/messages" ? json({ content: [{ type: "text", text }], usage }) : undefined));
}

let restore: () => void;
beforeEach(() => {
  restore = saveEnv();
  resetAiLedger();
});
afterEach(() => restore());

describe("ranking real posts", () => {
  it("ranks by interactions per reached account, then posts without reach", () => {
    expect(rankPosts(POSTS).map((p) => p.id)).toEqual(["b", "a", "old", "c"]);
    expect(topPosts(POSTS, 2).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("computes the week from the posts alone", () => {
    const m = computeWeeklyMetrics(POSTS, [], NOW);
    expect(m.posts).toBe(3);
    expect(m.previousPosts).toBe(1);
    expect(m.interactions).toBe(200);
    expect(m.reach).toBe(1500);
    expect(m.engagementRate).toBeCloseTo(110 / 1500);
    expect(m.best?.id).toBe("b");
  });

  it("rejects prose that cites a number not in the facts", () => {
    const facts = weeklyFacts(computeWeeklyMetrics(POSTS, [], NOW));
    expect(proseUsesOnlyFacts("You published 3 posts with 200 interactions.", facts)).toBe(true);
    expect(proseUsesOnlyFacts("Reach grew 45% this week.", facts)).toBe(false);
  });
});

describe("weekly report", () => {
  const snap: InsightsSnapshot = {
    fetchedAt: NOW.toISOString(),
    verification: { ok: true, checkedAt: NOW.toISOString(), expiresAt: null, expired: false, scopes: [] },
    instagram: { ok: true, account: { network: "instagram", id: "1", name: "@lumen", followers: 1200, periodDays: 7, reach: null, views: null, interactions: null }, posts: POSTS, warnings: [] },
    facebook: { ok: false, error: "HELIX_META_PAGE_ID is not set." },
  };

  it("keeps Claude's prose when it only uses computed numbers, and records the estimated cost", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { fetch, calls } = claudeReply("A steady week: 3 posts and 200 interactions.");
    const report = await writeWeeklyReport(snap, BRAND, { fetchImpl: fetch, now: NOW });
    expect(report.engine).toBe("claude");
    expect(JSON.parse(calls[0].body).model).toBe("claude-sonnet-4-20250514");
    expect(aiUsageTotals()).toMatchObject({ calls: 1, inputTokens: 1000, outputTokens: 200 });
    expect(aiUsageTotals().estUsd).toBeCloseTo(estimateUsd(1000, 200));
    expect(estimateUsd(1_000_000, 0)).toBe(3);
  });

  it("discards prose with an invented number", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { fetch } = claudeReply("Engagement rose 37% versus last month.");
    const report = await writeWeeklyReport(snap, BRAND, { fetchImpl: fetch, now: NOW });
    expect(report.engine).toBe("computed");
    expect(report.prose).not.toContain("37");
  });

  it("falls back to computed facts without an API key", async () => {
    const { fetch, calls } = mockFetch();
    const report = await writeWeeklyReport(snap, BRAND, { fetchImpl: fetch, now: NOW });
    expect(report.engine).toBe("computed");
    expect(calls).toHaveLength(0);
  });
});

describe("drafts from top posts", () => {
  it("keeps only drafts that cite a real top post and sends them to review", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { fetch, calls } = claudeReply(
      JSON.stringify({
        drafts: [
          { channel: "instagram", pillar: "education", caption: "Save this brew guide.", hashtags: ["#coffee"], inspiredBy: ["P1"], why: "Saves drove P1." },
          { channel: "instagram", pillar: "product", caption: "No source.", hashtags: [], inspiredBy: [] },
          { channel: "x", pillar: "product", caption: "Wrong channel.", hashtags: [], inspiredBy: ["P2"] },
        ],
      })
    );
    const { drafts, top } = await draftsFromTopPosts(POSTS, BRAND, { fetchImpl: fetch, now: NOW });
    expect(top[0].id).toBe("b");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ status: "needs_review", createdBy: "helix_ai", hashtags: ["coffee"], inspiredBy: [{ id: "b", permalink: "https://instagram.com/p/b" }] });
    expect(drafts[0].notes.some((n) => n.includes("https://instagram.com/p/b") && n.includes("50 interactions"))).toBe(true);
    expect(JSON.parse(calls[0].body).messages[0].content).toContain("[P1] instagram");
  });

  it("refuses when no real post has results", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { fetch, calls } = mockFetch();
    await expect(draftsFromTopPosts([real("z", {})], BRAND, { fetchImpl: fetch })).rejects.toThrow(/nothing to learn from/);
    expect(calls).toHaveLength(0);
  });
});
