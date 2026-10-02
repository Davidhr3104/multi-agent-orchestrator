import { describe, expect, it } from "vitest";
import { suggestSlot } from "./schedule";

describe("schedule guidelines", () => {
  it("keeps a same-day morning slot when it is still ahead", () => {
    const now = new Date(2026, 8, 30, 8, 0, 0);
    const slot = suggestSlot("instagram", "product", now);
    const when = new Date(slot.iso);
    expect(when.getDate()).toBe(30);
    expect(when.getHours()).toBe(11);
    expect(slot.reason).toMatch(/not this account's analytics/);
  });

  it("moves LinkedIn off the weekend", () => {
    const saturday = new Date(2026, 9, 3, 15, 0, 0);
    expect(saturday.getDay()).toBe(6);
    const slot = suggestSlot("linkedin", "education", saturday);
    expect(new Date(slot.iso).getDay()).toBe(1);
    expect(new Date(slot.iso).getHours()).toBe(8);
  });
});
