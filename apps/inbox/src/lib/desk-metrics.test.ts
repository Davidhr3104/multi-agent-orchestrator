import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoHistory } from "./demo-history";
import { confidenceHistogram, dailyVolume, deskCounts, describeLogDecision, hourDayMatrix } from "./desk-metrics";
import { estimateMinutesSaved, summarizeInboxSla } from "./sla";
import { summarizeWeek } from "./weekly-report";
import { listAllThreads, listMessages, loadDemoCatalog } from "./store";
import { DEFAULT_ACCOUNT_ID, DEFAULT_TO_EMAIL, DEFAULT_WORKSPACE_ID, type EmailThread } from "./types";

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("one definition of a thread across pages", () => {
  it("dashboard, SLA, analytics and weekly report agree on the same numbers", async () => {
    const threads = await listAllThreads();
    const now = Date.now();
    const messages = await listMessages();
    expect(messages).toHaveLength(threads.length);

    // Weekly report (7d) and the desk counts used by dashboard/analytics (7d) must match.
    const week = summarizeWeek(threads, { now });
    const w7 = deskCounts(threads, { now, windowDays: 7 });
    expect(week.threadsHandled).toBe(w7.total);
    expect(week.spamBlocked).toBe(w7.spamBlocked);
    expect(week.autoHandled).toBe(w7.autoHandled);
    expect(week.hoursSaved).toBe(w7.hoursSaved);

    // SLA page (14d window) and analytics (14d) agree, and open/breach are the same at every window.
    const sla = summarizeInboxSla(threads, { now, windowDays: 14 });
    const w14 = deskCounts(threads, { now, windowDays: 14 });
    expect(sla.hoursSaved).toBe(w14.hoursSaved);
    expect(sla.breachCount).toBe(w14.breachCount);
    expect(w14.breachCount).toBe(w7.breachCount);
    expect(w14.openCount).toBe(w7.openCount);
    expect(week.breachCount).toBe(w14.breachCount);

    // Hours saved is one formula.
    expect(w14.minutesSaved).toBe(estimateMinutesSaved(w14.spamBlocked, w14.autoHandled));
    // Spam blocked counts as a thread.
    expect(w14.total).toBe(threads.length);
    expect(w14.spamBlocked).toBeGreaterThan(0);
  });

  it("the daily series sums to the same total as the counts", async () => {
    const threads = await listAllThreads();
    const now = Date.now();
    const days = dailyVolume(threads, 14, now, 0);
    expect(days).toHaveLength(14);
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(deskCounts(threads, { now, windowDays: 14 }).total);
    expect(days.filter((d) => d.total > 0).length).toBeGreaterThanOrEqual(10);
    const matrix = hourDayMatrix(threads, 0, 14, now);
    expect(matrix.flat().reduce((a, b) => a + b, 0)).toBe(deskCounts(threads, { now, windowDays: 14 }).total);
  });
});

describe("helpers", () => {
  it("bins confidence into 6 buckets that cover every value", () => {
    const hist = confidenceHistogram([10, 55, 65, 75, 85, 95, 100, 49.6]);
    expect(hist.reduce((s, b) => s + b.value, 0)).toBe(8);
    expect(hist[5].value).toBe(2);
  });

  it("turns raw JSON patches into text", () => {
    expect(describeLogDecision({ actionType: "read", aiDecision: '{"isRead":true}' })).toBe("Marked as read");
    expect(describeLogDecision({ actionType: "triage", aiDecision: "action_required/positive score=92" })).toMatch(/Action required/);
  });

  it("windows by receivedAt, not createdAt", () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    const base = { workspaceId: DEFAULT_WORKSPACE_ID, emailAccountId: DEFAULT_ACCOUNT_ID, toEmail: DEFAULT_TO_EMAIL } as const;
    const mk = (id: string, receivedAt: string, createdAt: string): EmailThread =>
      ({ ...base, id, receivedAt, createdAt, status: "archived", category: "fyi", needsReview: false, aiConfidence: 90, fromEmail: "a@b.c" }) as unknown as EmailThread;
    const rows = [mk("a", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"), mk("b", "2026-10-01T00:00:00Z", "2026-09-01T00:00:00Z")];
    expect(deskCounts(rows, { now, windowDays: 7 }).total).toBe(1);
  });

  it("history builder output is covered by the demo catalog", () => {
    expect(buildDemoHistory(Date.now()).threads.length).toBeGreaterThan(40);
  });
});
