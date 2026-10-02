import { describe, expect, it } from "vitest";
import { applyRewrite, repurposeDraft } from "./copilot";
import { scoreReadiness } from "./readiness";
import { DEMO_BRAND } from "./seed";
import type { Post } from "./types";

const ctx = { channel: "instagram" as const, pillar: "product" as const, brand: DEMO_BRAND };

describe("co-pilot rewrites", () => {
  it("drops filler and keeps the first two sentences when the selection is long", () => {
    const text = "This is a really very long note about the harvest, the roast curve and the people who cupped it twice. It actually keeps going into the cooling tray and the bags. A third sentence should fall away for a concise cut.";
    const out = applyRewrite(text, "concise", ctx);
    expect(out.text.toLowerCase()).not.toMatch(/\breally\b/);
    expect(out.text).not.toMatch(/third sentence/);
  });

  it("adds a channel CTA when the draft has none", () => {
    const out = applyRewrite("The Huila lot tastes like red apple and panela.", "cta", ctx);
    expect(out.text.toLowerCase()).toMatch(/link in bio/);
  });

  it("refuses emojis when the brand directive says never", () => {
    const brand = { ...DEMO_BRAND, directives: "never: emojis" };
    const out = applyRewrite("A quiet morning at the roastery.", "emojis", { ...ctx, brand });
    expect(out.blocked).toMatch(/emoji/i);
  });

  it("strips words the brand avoids while shifting tone", () => {
    const out = applyRewrite("This drop is a game-changer for your mornings.", "professional", ctx);
    expect(out.text.toLowerCase()).not.toMatch(/game-changer/);
  });

  it("turns a long LinkedIn caption into an X draft that still scores cleanly", () => {
    const source = {
      caption:
        "We're hiring a production roaster. You'll run our 15 kg Loring three days a week, cup every batch with the team, and help us dial in new lots as they land. Two years of roasting experience preferred. Read more and apply through the link in the comments.",
      hashtags: ["hiring", "coffeejobs", "extraone", "extratwo"],
      pillar: "behind_the_scenes" as const,
    };
    const draft = repurposeDraft(source, "x", DEMO_BRAND);
    const post: Post = {
      id: "rep",
      channel: "x",
      pillar: "behind_the_scenes",
      scheduledFor: new Date().toISOString(),
      caption: draft.caption,
      hashtags: draft.hashtags,
      asset: "Team photo",
      status: "draft",
      createdBy: "helix_ai",
      notes: [],
    };
    const score = scoreReadiness(post, DEMO_BRAND);
    expect(draft.caption.length).toBeLessThanOrEqual(280);
    expect(score.factors.find((f) => f.label === "Length")?.points).toBeGreaterThan(0);
    expect(score.factors.find((f) => f.label === "Call to action")?.points).toBe(20);
    expect(draft.hashtags.length).toBeLessThanOrEqual(2);
  });
});
