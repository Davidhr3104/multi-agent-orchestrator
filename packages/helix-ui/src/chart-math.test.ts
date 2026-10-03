import { describe, expect, it } from "vitest";
import { areaPath, clamp01, compact, healthTone, linePath, niceMax, ringSegment, seriesPoints, sliceAngles, smoothPath } from "./chart-math";

describe("niceMax", () => {
  it("rounds up to round numbers and never returns zero", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(Number.NaN)).toBe(1);
  });
});

describe("seriesPoints", () => {
  it("spreads values across the box, higher values nearer the top", () => {
    const pts = seriesPoints([0, 5, 10], 100, 50);
    expect(pts[0]).toEqual([0, 50]);
    expect(pts[2]).toEqual([100, 0]);
    expect(pts[1][1]).toBe(25);
  });
  it("centres a single value instead of dropping it, and handles empty and flat series", () => {
    expect(seriesPoints([4], 100, 50)).toHaveLength(1);
    expect(seriesPoints([4], 100, 50)[0][0]).toBe(50);
    expect(seriesPoints([], 100, 50)).toEqual([]);
    expect(seriesPoints([3, 3, 3], 100, 50).every((p) => Number.isFinite(p[1]))).toBe(true);
  });
  it("keeps the path finite when a value is NaN or Infinity, and supports a negative floor", () => {
    expect(seriesPoints([1, Number.NaN, Number.POSITIVE_INFINITY, 4], 100, 50).flat().every(Number.isFinite)).toBe(true);
    const neg = seriesPoints([-10, 0, 10], 100, 50, 0, 10, -10);
    expect(neg[0][1]).toBe(50);
    expect(neg[1][1]).toBe(25);
  });
});

describe("paths", () => {
  it("builds a line and closes an area down to the baseline", () => {
    const pts = [[0, 10], [10, 0]] as const;
    expect(linePath(pts)).toBe("M0,10 L10,0");
    expect(areaPath(pts, 20)).toBe("M0,10 L10,0 L10,20 L0,20 Z");
    expect(areaPath([], 20)).toBe("");
  });
  it("smooths with curves for 3+ points and stays straight below that", () => {
    expect(smoothPath([[0, 0], [1, 1]])).toBe("M0,0 L1,1");
    expect(smoothPath([[0, 0], [1, 1], [2, 0]])).toContain("C");
  });
});

describe("sliceAngles", () => {
  it("covers the full circle, starts at 12 o'clock and ignores empty slices", () => {
    const a = sliceAngles([{ label: "a", value: 3 }, { label: "b", value: 0 }, { label: "c", value: 1 }]);
    expect(a).toHaveLength(2);
    expect(a[0].a0).toBeCloseTo(-Math.PI / 2);
    expect(a[1].a1).toBeCloseTo(-Math.PI / 2 + Math.PI * 2);
    expect(a[0].share).toBeCloseTo(0.75);
  });
  it("returns nothing when there is no positive total", () => {
    expect(sliceAngles([{ label: "a", value: 0 }])).toEqual([]);
    expect(sliceAngles([{ label: "a", value: Number.NaN }, { label: "b", value: -2 }])).toEqual([]);
  });
});

describe("ringSegment", () => {
  it("produces a closed path, and a full circle does not collapse to nothing", () => {
    expect(ringSegment(50, 50, 40, 25, 0, 1)).toMatch(/^M.* Z$/);
    const full = ringSegment(50, 50, 40, 25, -Math.PI / 2, (3 * Math.PI) / 2);
    expect((full.match(/M/g) ?? []).length).toBe(2);
  });
});

describe("formatting and tone", () => {
  it("compacts large numbers", () => {
    expect(compact(950)).toBe("950");
    expect(compact(12_400)).toBe("12.4k");
    expect(compact(3_200_000)).toBe("3.2M");
    expect(compact(Number.NaN)).toBe("–");
  });
  it("clamps ratios and maps them to a tone", () => {
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
    expect([healthTone(0.9), healthTone(0.5), healthTone(0.1)]).toEqual(["good", "warn", "bad"]);
  });
});
