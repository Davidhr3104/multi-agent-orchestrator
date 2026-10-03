import { describe, expect, it } from "vitest";
import { formatSlot } from "./format";
import { suggestSlot } from "./schedule";
import { zonedTime, zoneParts } from "./tz";

describe("schedule guidelines", () => {
  it("keeps a same-day morning slot when it is still ahead", () => {
    const now = zonedTime(2026, 9, 30, 8);
    const slot = suggestSlot("instagram", "product", now);
    const when = zoneParts(slot.iso);
    expect(when.day).toBe(30);
    expect(when.hour).toBe(11);
    expect(slot.reason).toMatch(/not this account's analytics/);
  });

  it("moves LinkedIn off the weekend", () => {
    const saturday = zonedTime(2026, 10, 3, 15);
    expect(zoneParts(saturday).dow).toBe(6);
    const slot = suggestSlot("linkedin", "education", saturday);
    expect(zoneParts(slot.iso).dow).toBe(1);
    expect(zoneParts(slot.iso).hour).toBe(8);
  });

  it("prints the same hour in the reason and the apply button, whatever the machine zone is", () => {
    const slot = suggestSlot("instagram", "product", zonedTime(2026, 10, 2, 9));
    expect(slot.reason).toMatch(/around 11am ET/);
    expect(slot.reason).toMatch(/11:00 AM ET/);
    expect(formatSlot(slot.iso)).toMatch(/11:00 AM/);
  });
});
