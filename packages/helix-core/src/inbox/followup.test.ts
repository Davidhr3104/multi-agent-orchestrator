import { describe, it, expect } from "vitest";
import { shouldClearFollowup } from "./followup";

const THREAD = { lastReplySentAt: "2026-09-23T12:00:00.000Z", toEmail: "triage@company.io" };

describe("shouldClearFollowup", () => {
  it("does not clear on an echo of our own reply (same sender as toEmail)", () => {
    const result = shouldClearFollowup(THREAD, {
      fromEmail: "triage@company.io",
      alreadyKnown: false,
      sentAt: "2026-09-24T12:00:00.000Z",
    });
    expect(result).toBe(false);
  });

  it("does not clear when the same original message is re-listed after our reply (C1 regression case)", () => {
    // Genuinely a different sender, but we've already recorded this exact message before.
    const result = shouldClearFollowup(THREAD, {
      fromEmail: "jane@example.com",
      alreadyKnown: true,
      sentAt: "2026-09-20T12:00:00.000Z",
    });
    expect(result).toBe(false);
  });

  it("clears on a genuinely new, later inbound message", () => {
    const result = shouldClearFollowup(THREAD, {
      fromEmail: "jane@example.com",
      alreadyKnown: false,
      sentAt: "2026-09-24T12:00:00.000Z",
    });
    expect(result).toBe(true);
  });

  it("does not clear a stale/older .eml upload (sentAt before lastReplySentAt)", () => {
    const result = shouldClearFollowup(THREAD, {
      fromEmail: "jane@example.com",
      alreadyKnown: false,
      sentAt: "2026-09-22T12:00:00.000Z",
    });
    expect(result).toBe(false);
  });

  it("does not clear when lastReplySentAt is not set at all", () => {
    const result = shouldClearFollowup(
      { toEmail: "triage@company.io" },
      { fromEmail: "jane@example.com", alreadyKnown: false, sentAt: "2026-09-24T12:00:00.000Z" }
    );
    expect(result).toBe(false);
  });

  it("still clears when sentAt is not provided but sender is new and unknown", () => {
    const result = shouldClearFollowup(THREAD, {
      fromEmail: "jane@example.com",
      alreadyKnown: false,
    });
    expect(result).toBe(true);
  });
});
