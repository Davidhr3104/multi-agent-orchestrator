import { describe, expect, it } from "vitest";
import { buildDemoHistory, DEMO_HISTORY_DAYS, DEMO_HISTORY_PREFIX } from "./demo-history";

const NOW = Date.parse("2026-10-02T15:30:00.000Z");

describe("buildDemoHistory", () => {
  it("is deterministic for a given moment", () => {
    expect(buildDemoHistory(NOW)).toEqual(buildDemoHistory(NOW));
  });

  it("spreads threads over all 14 days and never into the future", () => {
    const { threads } = buildDemoHistory(NOW);
    const days = new Set(threads.map((t) => t.receivedAt.slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(DEMO_HISTORY_DAYS - 3);
    for (const t of threads) {
      expect(Date.parse(t.receivedAt)).toBeLessThanOrEqual(NOW);
      expect(t.id.startsWith(DEMO_HISTORY_PREFIX)).toBe(true);
    }
  });

  it("follows a business-hours rhythm instead of a flat line", () => {
    const { threads } = buildDemoHistory(NOW);
    const byHour = new Array<number>(24).fill(0);
    for (const t of threads) byHour[new Date(t.receivedAt).getUTCHours()] += 1;
    const peak = byHour.slice(8, 12).reduce((a, b) => a + b, 0);
    const night = byHour.slice(0, 4).reduce((a, b) => a + b, 0);
    expect(peak).toBeGreaterThan(night * 3);
  });

  it("only produces closed threads, so the live queue stays the featured demo threads", () => {
    const { threads } = buildDemoHistory(NOW);
    expect(threads.every((t) => ["sent", "routed", "archived", "blocked"].includes(t.status) && !t.needsReview)).toBe(true);
  });

  it("never shows a reply as sent unless a person approved it", () => {
    const { threads, logs } = buildDemoHistory(NOW);
    const approved = new Set(logs.filter((l) => l.humanOverride).map((l) => l.threadId));
    expect(threads.filter((t) => t.status === "sent").every((t) => approved.has(t.id))).toBe(true);
  });

  it("writes one plain-English log row per thread and no raw JSON", () => {
    const { threads, logs } = buildDemoHistory(NOW);
    expect(logs).toHaveLength(threads.length);
    expect(logs.some((l) => l.aiDecision.startsWith("{"))).toBe(false);
  });
});
