import { describe, expect, it } from "vitest";
import { hardBlockers, postLength, scoreReadiness } from "./readiness";
import { buildSeedPosts, DEMO_BRAND } from "./seed";
import type { Post } from "./types";

const base: Post = {
  id: "t",
  channel: "instagram",
  pillar: "product",
  scheduledFor: new Date().toISOString(),
  caption: "Fresh Huila lot, roasted light so the fruit stays loud. Grab a bag through the link in bio before Friday.",
  hashtags: ["coffee", "lightroast", "specialtycoffee"],
  asset: "Bag on the roasting table",
  status: "needs_review",
  createdBy: "helix_ai",
  notes: [],
};

describe("readiness score", () => {
  it("gives a well-formed post every point and marks it ready", () => {
    const r = scoreReadiness(base, DEMO_BRAND);
    expect(r.score).toBe(100);
    expect(r.ready).toBe(true);
    expect(r.factors.map((f) => f.label)).toEqual(["Length", "Hashtags", "Call to action", "Brand voice", "Visual brief"]);
  });

  it("blocks an X post over 280 characters regardless of the rest", () => {
    const r = scoreReadiness({ ...base, channel: "x", hashtags: [], caption: `${"word ".repeat(60)}shop now` }, DEMO_BRAND);
    expect(hardBlockers(r.factors).map((f) => f.label)).toEqual(["Length"]);
    expect(r.ready).toBe(false);
    expect(r.summary).toMatch(/^Blocked/);
  });

  it("blocks words on the brand's avoid list", () => {
    const r = scoreReadiness({ ...base, caption: `${base.caption} A total game-changer.` }, DEMO_BRAND);
    expect(r.ready).toBe(false);
    expect(r.factors.find((f) => f.label === "Brand voice")?.detail).toMatch(/game-changer/);
  });

  it("counts hashtags toward the channel length", () => {
    expect(postLength({ caption: "abc", hashtags: ["de", "fg"] })).toBe("abc #de #fg".length);
  });

  it("penalizes missing CTA and visual brief without blocking", () => {
    const r = scoreReadiness({ ...base, caption: "A quiet morning at the roastery with the new Huila lot on the cooling tray.", asset: "" }, DEMO_BRAND);
    expect(hardBlockers(r.factors)).toHaveLength(0);
    expect(r.score).toBe(100 - 14 - 15);
    expect(r.ready).toBe(false);
  });

  it("seeds a mix of ready and not-ready posts in the review queue", () => {
    const queue = buildSeedPosts().filter((p) => p.status === "needs_review").map((p) => scoreReadiness(p, DEMO_BRAND));
    expect(queue.some((r) => r.ready)).toBe(true);
    expect(queue.some((r) => !r.ready)).toBe(true);
    expect(queue.some((r) => hardBlockers(r.factors).length > 0)).toBe(true);
  });

  it("places every seed post from today forward", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(buildSeedPosts().every((p) => Date.parse(p.scheduledFor) >= today.getTime())).toBe(true);
  });
});
