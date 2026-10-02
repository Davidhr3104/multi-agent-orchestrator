import { describe, expect, it } from "vitest";
import { pillarGaps } from "./gaps";
import type { Pillar } from "./types";

function at(day: number, pillar: Pillar) {
  const d = new Date(2026, 8, 30);
  d.setDate(d.getDate() + day);
  d.setHours(9, 0, 0, 0);
  return { pillar, scheduledFor: d.toISOString() };
}

describe("pillar gaps", () => {
  it("flags a pillar with nothing in the next four days", () => {
    const now = new Date(2026, 8, 30, 8, 0, 0);
    const gaps = pillarGaps([at(0, "product"), at(6, "education")], now);
    expect(gaps.some((g) => g.pillar === "education" && g.daysUntil === 6)).toBe(true);
    expect(gaps.some((g) => g.pillar === "product" && g.holeAfter === null && g.daysUntil === 0)).toBe(false);
    expect(gaps.map((g) => g.pillar)).toContain("community");
  });

  it("flags a hole after a pillar shows up and then disappears", () => {
    const now = new Date(2026, 8, 30, 8, 0, 0);
    const gaps = pillarGaps([at(0, "product"), at(8, "product")], now);
    const product = gaps.find((g) => g.pillar === "product");
    expect(product?.holeAfter).toBe(0);
    expect(product?.holeUntil).toBe(8);
  });
});
