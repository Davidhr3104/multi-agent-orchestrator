import { beforeEach, describe, expect, it } from "vitest";
import { deskCounts } from "../desk-metrics";
import { listAllThreads, loadDemoCatalog } from "../store";
import { buildSourceText } from "./digest";

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("daily digest content comes from the same counts as every page", () => {
  it("reports exactly the desk counts for the last 24 hours, nothing invented", async () => {
    const threads = await listAllThreads();
    const now = Date.now();
    const counts = deskCounts(threads, { now, windowDays: 1 });
    const out = buildSourceText("inbox.daily_digest", threads, { now });
    expect(out.text).toContain(`${counts.total} thread${counts.total === 1 ? "" : "s"} received`);
    expect(out.text).toContain(`${counts.reviewCount}`);
    expect(out.text).toContain(`${counts.breachCount}`);
    expect(out.facts.received).toBe(counts.total);
    expect(out.facts.awaitingReview).toBe(counts.reviewCount);
    expect(out.facts.slaBreaches).toBe(counts.breachCount);
    expect(out.facts.spamBlocked).toBe(counts.spamBlocked);
  });

  it("names only real threads from the desk in the 'needs you' list", async () => {
    const threads = await listAllThreads();
    const out = buildSourceText("inbox.daily_digest", threads, { now: Date.now() });
    const real = new Set(threads.map((t) => t.subject));
    for (const subject of out.facts.needsYou) expect(real.has(subject)).toBe(true);
    expect(out.facts.needsYou.length).toBeLessThanOrEqual(3);
  });

  it("says plainly when there is nothing to report", () => {
    const out = buildSourceText("inbox.daily_digest", [], { now: Date.now() });
    expect(out.text).toMatch(/0 threads received/);
    expect(out.text).not.toMatch(/undefined|NaN/);
  });

  it("the SLA source lists breaches or says there are none", async () => {
    const threads = await listAllThreads();
    const now = Date.now();
    const counts = deskCounts(threads, { now });
    const out = buildSourceText("inbox.sla_breaches", threads, { now });
    expect(out.facts.slaBreaches).toBe(counts.breachCount);
    if (counts.breachCount === 0) expect(out.text).toMatch(/no thread is past/i);
  });

  it("refuses an unknown source instead of returning empty text", () => {
    expect(() => buildSourceText("inbox.nope", [], { now: Date.now() })).toThrow(/unknown source/i);
  });
});
