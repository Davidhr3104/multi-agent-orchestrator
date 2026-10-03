import { describe, expect, it } from "vitest";
import { channelPillarMatrix, plannedPerDay, readinessBins, statusFunnel } from "./analytics";

describe("calendar charts data", () => {
  it("bins readiness scores at the band edges", () => {
    const bins = readinessBins([0, 59, 60, 84, 85, 99, 100, 100]);
    expect(bins.map((b) => b.count)).toEqual([2, 2, 2, 2]);
  });

  it("builds a cumulative funnel that never grows down the stages", () => {
    const steps = statusFunnel(["draft", "needs_review", "changes", "approved", "published"]);
    expect(steps.map((s) => s.value)).toEqual([5, 4, 2, 1]);
  });

  it("splits channels by pillar", () => {
    const rows = channelPillarMatrix([
      { channel: "x", pillar: "promo" },
      { channel: "x", pillar: "promo" },
      { channel: "instagram", pillar: "product" },
    ]);
    expect(rows.find((r) => r.channel === "x")?.byPillar.promo).toBe(2);
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(3);
  });

  it("buckets planned posts by desk-zone day", () => {
    const now = new Date("2026-10-03T14:00:00Z");
    const days = plannedPerDay([{ scheduledFor: "2026-10-03T13:00:00Z" }, { scheduledFor: "2026-10-04T13:00:00Z" }, { scheduledFor: "2026-10-04T15:00:00Z" }], 3, now);
    expect(days.map((d) => d.count)).toEqual([1, 2, 0]);
    expect(days[0].key).toBe("2026-10-03");
  });
});
