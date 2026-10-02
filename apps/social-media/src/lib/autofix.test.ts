import { describe, expect, it } from "vitest";
import { autoFixDraft } from "./autofix";
import { scoreReadiness } from "./readiness";
import { buildSeedPosts, DEMO_BRAND, HARBOR_BRAND, buildHarborPosts } from "./seed";
import type { Post } from "./types";

function score(post: Post, brand: typeof DEMO_BRAND) {
  const fixed = autoFixDraft(post, brand);
  return scoreReadiness({ ...post, ...fixed }, brand).score;
}

describe("auto-fix", () => {
  it("lifts blocked and short seed posts to a perfect score", () => {
    const brands = [
      [buildSeedPosts(), DEMO_BRAND],
      [buildHarborPosts(), HARBOR_BRAND],
    ] as const;
    for (const [posts, brand] of brands) {
      for (const post of posts) {
        expect(score(post, brand)).toBe(100);
      }
    }
  });
});
