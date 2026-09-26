import { describe, it, expect } from "vitest";
import { businessDaysBetween, isOverdue } from "./business-days";

describe("businessDaysBetween", () => {
  it("counts zero business days between the same weekday timestamp", () => {
    const from = new Date("2026-09-23T14:00:00Z"); // Wed
    const to = new Date("2026-09-23T18:00:00Z"); // same Wed, later
    expect(businessDaysBetween(from, to)).toBe(0);
  });

  it("counts one business day from Wednesday to Thursday", () => {
    const from = new Date("2026-09-23T14:00:00Z"); // Wed
    const to = new Date("2026-09-24T14:00:00Z"); // Thu
    expect(businessDaysBetween(from, to)).toBe(1);
  });

  it("does not count weekend days from Friday to Monday", () => {
    const from = new Date("2026-09-25T14:00:00Z"); // Fri
    const to = new Date("2026-09-28T14:00:00Z"); // Mon
    expect(businessDaysBetween(from, to)).toBe(1);
  });

  it("counts two business days from Thursday to Monday", () => {
    const from = new Date("2026-09-24T14:00:00Z"); // Thu
    const to = new Date("2026-09-28T14:00:00Z"); // Mon
    expect(businessDaysBetween(from, to)).toBe(2);
  });
});

describe("isOverdue", () => {
  it("is not overdue before 2 business days have passed", () => {
    const sentAt = "2026-09-23T14:00:00.000Z"; // Wed
    const now = new Date("2026-09-24T14:00:00Z"); // Thu, 1 business day later
    expect(isOverdue(sentAt, now)).toBe(false);
  });

  it("is overdue at exactly 2 business days", () => {
    const sentAt = "2026-09-23T14:00:00.000Z"; // Wed
    const now = new Date("2026-09-25T14:00:00Z"); // Fri, 2 business days later
    expect(isOverdue(sentAt, now)).toBe(true);
  });

  it("weekend does not shorten the wait", () => {
    const sentAt = "2026-09-25T14:00:00.000Z"; // Fri
    const now = new Date("2026-09-28T14:00:00Z"); // Mon, 1 business day later
    expect(isOverdue(sentAt, now)).toBe(false);
  });
});
