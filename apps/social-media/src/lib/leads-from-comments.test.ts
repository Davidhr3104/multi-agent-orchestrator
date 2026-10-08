import { describe, expect, it } from "vitest";
import { classifyAudienceComment, leadsByPost } from "./leads-from-comments";
import type { AudienceComment, Post } from "./types";

const post = (id: string): Post => ({
  id,
  channel: "instagram",
  pillar: "product",
  scheduledFor: "2026-10-06T15:00:00.000Z",
  caption: "Huila harvest",
  hashtags: [],
  asset: "bag",
  status: "needs_review",
  createdBy: "team",
  notes: [],
});

describe("leads from comments", () => {
  it("classifies interested vs complaint vs spam", () => {
    expect(classifyAudienceComment("How much and can I book a pickup?")).toBe("lead");
    expect(classifyAudienceComment("This is a scam, never again")).toBe("complaint");
    expect(classifyAudienceComment("Crypto giveaway click here")).toBe("spam");
    expect(classifyAudienceComment("Nice roast")).toBe("unsure");
  });

  it("ranks posts by lead comments in the window", () => {
    const comments: AudienceComment[] = [
      { id: "1", postId: "a", text: "Interested — DM me the price", kind: "lead", at: "2026-10-05T12:00:00.000Z", demo: true, handedToLeads: false },
      { id: "2", postId: "a", text: "Can I book?", kind: "lead", at: "2026-10-06T12:00:00.000Z", demo: true, handedToLeads: false },
      { id: "3", postId: "b", text: "How much?", kind: "lead", at: "2026-10-06T12:00:00.000Z", demo: true, handedToLeads: false },
    ];
    const ranked = leadsByPost([post("a"), post("b")], comments, "2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z");
    expect(ranked[0]?.postId).toBe("a");
    expect(ranked[0]?.leads).toBe(2);
  });
});
