import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { AreaChart, Avatar, ChartCard, Donut, Funnel, Gauge, HBarList, Heatmap, KpiCard, ScoreRing, Sparkline, StackedBar } from "./index";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("charts render safely with real and empty data", () => {
  it("every chart exposes an accessible label and survives empty input", () => {
    expect(html(<Sparkline values={[1, 3, 2, 5]} label="Revenue trend" />)).toContain('aria-label="Revenue trend"');
    expect(html(<Sparkline values={[1]} label="x" />)).toBe("");
    expect(html(<AreaChart points={[{ label: "Mon", value: 4 }, { label: "Tue", value: 9 }]} ariaLabel="Volume by day" />)).toContain('aria-label="Volume by day"');
    expect(html(<AreaChart points={[]} ariaLabel="x" />)).toContain("No data yet");
    expect(html(<Donut slices={[{ label: "Hot", value: 3 }, { label: "Cold", value: 1 }]} ariaLabel="Tiers" centerValue={4} />)).toContain("75%");
    expect(html(<Donut slices={[]} ariaLabel="x" />)).toContain("No data yet");
    expect(html(<HBarList items={[]} />)).toContain("No data yet");
    expect(html(<StackedBar segments={[]} ariaLabel="x" />)).toContain("No data yet");
    expect(html(<Funnel steps={[]} />)).toContain("No data yet");
  });

  it("a single-slice donut still draws, and a zero-width funnel step does not break", () => {
    expect(html(<Donut slices={[{ label: "All", value: 5 }]} ariaLabel="One" />)).toContain("<path");
    expect(html(<Funnel steps={[{ label: "Leads", value: 100 }, { label: "Hot", value: 0 }]} />)).toContain("0%");
  });

  it("the funnel reports step-to-step conversion and the bar list draws its threshold", () => {
    const f = html(<Funnel steps={[{ label: "Clicks", value: 200 }, { label: "Leads", value: 50 }]} />);
    expect(f).toContain("25%");
    expect(html(<HBarList items={[{ label: "Ad A", value: 90 }]} marker={80} markerLabel="Rule: $80" />)).toContain("Rule: $80");
  });

  it("the gauge colours by direction: high breaches are bad, high health is good", () => {
    expect(html(<Gauge value={9} max={10} label="Breaches" invert />)).toContain("#f87171");
    expect(html(<Gauge value={9} max={10} label="Health" />)).toContain("#34d399");
    expect(html(<Gauge value={0} max={0} label="Empty" />)).toContain("Empty");
  });

  it("the gauge arc stays a semicircle past half (large-arc flag is never set)", () => {
    const g = html(<Gauge value={8} max={10} label="Health" />);
    expect(g).not.toMatch(/A[\d.]+,[\d.]+ 0 1 1/);
    expect(g).toMatch(/A[\d.]+,[\d.]+ 0 0 1/);
  });

  it("area chart draws a lone point and a negative series without NaN", () => {
    expect(html(<AreaChart points={[{ label: "Mon", value: 4 }]} ariaLabel="One" />)).toContain("<circle");
    const neg = html(<AreaChart points={[{ label: "a", value: -30 }, { label: "b", value: 20 }, { label: "c", value: Number.NaN }]} ariaLabel="Net" />);
    expect(neg).not.toContain("NaN");
    expect(neg).toContain("-50");
  });

  it("heatmap without rows or columns shows an explicit empty state", () => {
    expect(html(<Heatmap rows={[]} columns={[]} cells={[]} ariaLabel="x" />)).toContain("No data yet");
  });

  it("a zero delta is neutral, not a green arrow", () => {
    const k = html(<KpiCard label="Open" value={1} delta={{ value: 0 }} />);
    expect(k).not.toContain("▲");
    expect(k).not.toContain("#34d399");
  });

  it("only area-chart.tsx is a client module, so server pages can pass function props to the rest", () => {
    const head = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8").slice(0, 40);
    expect(head("./area-chart.tsx")).toContain('"use client"');
    for (const f of ["./charts.tsx", "./cards.tsx", "./index.ts", "./chart-math.ts"]) expect(head(f)).not.toContain("use client");
  });

  it("heatmap, ring, kpi, avatar and card frame render, and the card labels sample data", () => {
    expect(html(<Heatmap rows={["Mon"]} columns={["9", "10"]} cells={[[0, 4]]} ariaLabel="Load" />)).toContain('aria-label="Load"');
    expect(html(<ScoreRing score={88} />)).toContain("88");
    expect(html(<KpiCard label="Open" value={12} delta={{ value: 8, label: "vs last week" }} spark={[1, 2, 3]} />)).toContain("▲");
    expect(html(<KpiCard label="Breaches" value={3} delta={{ value: 10, goodWhen: "down" }} />)).toContain("#f87171");
    expect(html(<Avatar name="Maya Chen" />)).toContain("MC");
    const card = html(<ChartCard title="T" demo source="Counted from this desk"><span /></ChartCard>);
    expect(card).toContain("Demo data");
    expect(card).toContain("Counted from this desk");
    expect(html(<ChartCard title="T" illustrative><span /></ChartCard>)).toContain("Illustrative");
  });
});
