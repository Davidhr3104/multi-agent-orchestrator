/** Pure geometry/format helpers behind the charts. No React, so they are unit-tested directly. */

export type Pt = readonly [number, number];

export const DEFAULT_COLORS = ["#c9a24b", "#5b8def", "#34d399", "#f59e0b", "#a78bfa", "#f472b6", "#94a3b8"] as const;

/** Rounds a maximum up to a "nice" axis bound (1, 2, 2.5, 5 × 10ⁿ) so gridlines land on round numbers. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const f = max / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

export function scaleLinear(domain: readonly [number, number], range: readonly [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/**
 * Points for a series laid out left→right inside a box. A single value is centred rather than dropped.
 * Non-finite values sit on `min` so one bad number cannot turn the whole path into NaN.
 */
export function seriesPoints(input: readonly number[], w: number, h: number, pad = 0, max?: number, min = 0): Pt[] {
  if (input.length === 0) return [];
  const values = input.map((v) => (Number.isFinite(v) ? v : min));
  const hi = max !== undefined && Number.isFinite(max) ? max : Math.max(...values);
  const x = scaleLinear([0, Math.max(1, values.length - 1)], [pad, w - pad]);
  const y = scaleLinear([min, hi === min ? min + 1 : hi], [h - pad, pad]);
  if (values.length === 1) return [[w / 2, y(values[0])]];
  return values.map((v, i) => [x(i), y(v)] as const);
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function linePath(pts: readonly Pt[]): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join(" ");
}

export function areaPath(pts: readonly Pt[], baseY: number): string {
  if (pts.length === 0) return "";
  const last = pts[pts.length - 1];
  return `${linePath(pts)} L${f(last[0])},${f(baseY)} L${f(pts[0][0])},${f(baseY)} Z`;
}

/** Catmull-Rom → cubic Bézier smoothing; falls back to straight segments for fewer than 3 points. */
export function smoothPath(pts: readonly Pt[], tension = 0.5): string {
  if (pts.length < 3) return linePath(pts);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

export function polar(cx: number, cy: number, r: number, angle: number): Pt {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/** SVG path for a ring segment between two angles (radians, 0 = 3 o'clock, clockwise). */
export function ringSegment(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  const sweep = a1 - a0;
  // A full circle cannot be drawn as one arc; split it in two.
  if (sweep >= Math.PI * 2 - 1e-6) {
    return `${ringSegment(cx, cy, rOuter, rInner, a0, a0 + Math.PI)} ${ringSegment(cx, cy, rOuter, rInner, a0 + Math.PI, a0 + Math.PI * 2 - 1e-4)}`;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, rOuter, a0);
  const [x1, y1] = polar(cx, cy, rOuter, a1);
  const [x2, y2] = polar(cx, cy, rInner, a1);
  const [x3, y3] = polar(cx, cy, rInner, a0);
  return `M${f(x0)},${f(y0)} A${rOuter},${rOuter} 0 ${large} 1 ${f(x1)},${f(y1)} L${f(x2)},${f(y2)} A${rInner},${rInner} 0 ${large} 0 ${f(x3)},${f(y3)} Z`;
}

export type Slice = { label: string; value: number; color?: string };

/** Slice angles starting at 12 o'clock. Zero, negative and non-finite values are dropped; share is of the positive total. */
export function sliceAngles(slices: readonly Slice[]): { slice: Slice; a0: number; a1: number; share: number }[] {
  const items = slices.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = items.reduce((s, x) => s + x.value, 0);
  if (total === 0) return [];
  let a = -Math.PI / 2;
  return items.map((slice) => {
    const share = slice.value / total;
    const a0 = a;
    a += share * Math.PI * 2;
    return { slice, a0, a1: a, share };
  });
}

export function compact(n: number): string {
  if (!Number.isFinite(n)) return "–";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${f(n / 1e9)}B`;
  if (abs >= 1e6) return `${f(n / 1e6)}M`;
  if (abs >= 1e4) return `${f(n / 1e3)}k`;
  return Number.isInteger(n) ? n.toLocaleString("en-US") : f(n).toString();
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

/** Deterministic "tone" for a 0–1 health ratio where higher is better. */
export function healthTone(ratio: number): "good" | "warn" | "bad" {
  const r = clamp01(ratio);
  return r >= 0.7 ? "good" : r >= 0.4 ? "warn" : "bad";
}

export const TONE_COLOR = { good: "#34d399", warn: "#f59e0b", bad: "#f87171", neutral: "#94a3b8" } as const;
