import { describe, expect, it } from "vitest";
import { buildMarketingSeed } from "./seed";
import { parseSpendCsv } from "./spendCsv";
import { splitJoinedAndUnmatched, windowBounds } from "./window";

describe("marketing windows", () => {
  it("keeps spend without scored leads in the unmatched queue", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    const seed = buildMarketingSeed(now);
    const { from, to } = windowBounds("90d", now);
    const { joined, unmatched } = splitJoinedAndUnmatched(seed.spend, seed.leads, from, to);
    expect(joined.some((r) => r.campaignId === "ad-a-volume")).toBe(true);
    expect(joined.some((r) => r.campaignId === "ad-e-orphan")).toBe(false);
    expect(unmatched.some((r) => r.campaignId === "ad-e-orphan")).toBe(true);
  });

  it("changes rollups across 7d vs 90d instead of sharing one snapshot", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    const seed = buildMarketingSeed(now);
    const week = windowBounds("7d", now);
    const quarter = windowBounds("90d", now);
    const seven = splitJoinedAndUnmatched(seed.spend, seed.leads, week.from, week.to);
    const ninety = splitJoinedAndUnmatched(seed.spend, seed.leads, quarter.from, quarter.to);
    const a7 = seven.joined.find((r) => r.campaignId === "ad-a-volume")?.spend ?? 0;
    const a90 = ninety.joined.find((r) => r.campaignId === "ad-a-volume")?.spend ?? 0;
    expect(a90).toBeGreaterThan(a7);
    expect(seven.joined.some((r) => r.campaignId === "ad-c-mid")).toBe(false);
    expect(ninety.joined.some((r) => r.campaignId === "ad-c-mid")).toBe(true);
  });
});

describe("parseSpendCsv dates", () => {
  it("reads an optional date column", () => {
    const rows = parseSpendCsv(`campaign_id,name,platform,spend,form_leads,date
orphan,Orphan,meta,40,2,2026-09-12
`);
    expect(Array.isArray(rows)).toBe(true);
    if (!Array.isArray(rows)) return;
    expect(rows[0].occurredAt).toBe("2026-09-12");
  });
});
