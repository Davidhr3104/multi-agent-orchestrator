import type { AiActionLog, EmailThread, ThreadCategory, ThreadStatus } from "@/lib/types";
import { estimateMinutesSaved, inWindow, isAutoHandled, isSpamBlocked, summarizeInboxSla } from "@/lib/sla";

/**
 * One definition of "thread" and one clock for every page:
 *  - a thread is any EmailThread on the desk, including spam that was blocked;
 *  - its time is receivedAt (createdAt only as a fallback);
 *  - hours saved always comes from estimateMinutesSaved in lib/sla.ts.
 * Dashboard, SLA, Analytics and Weekly report all read their numbers from deskCounts().
 */

export const DESK_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export type DeskCounts = {
  windowDays: number;
  total: number;
  spamBlocked: number;
  autoHandled: number;
  hoursSaved: number;
  minutesSaved: number;
  openCount: number;
  breachCount: number;
  atRiskCount: number;
  reviewCount: number;
  avgConfidence: number;
  hitlRate: number;
  handedOffToLeads: number;
};

export function deskCounts(
  threads: EmailThread[],
  opts?: { vipSenders?: string[]; now?: number; windowDays?: number }
): DeskCounts {
  const now = opts?.now ?? Date.now();
  const windowDays = opts?.windowDays ?? DESK_WINDOW_DAYS;
  const windowed = threads.filter((t) => inWindow(t, windowDays, now));
  const sla = summarizeInboxSla(threads, { vipSenders: opts?.vipSenders, now, windowDays });
  const total = windowed.length;
  const review = windowed.filter((t) => t.needsReview).length;
  return {
    windowDays,
    total,
    spamBlocked: sla.spamBlocked,
    autoHandled: sla.autoHandled,
    hoursSaved: sla.hoursSaved,
    minutesSaved: sla.minutesSaved,
    openCount: sla.openCount,
    breachCount: sla.breachCount,
    atRiskCount: sla.atRiskCount,
    reviewCount: threads.filter((t) => t.needsReview).length,
    avgConfidence: total ? Math.round(windowed.reduce((s, t) => s + t.aiConfidence, 0) / total) : 0,
    hitlRate: total ? Math.round((review / total) * 100) : 0,
    handedOffToLeads: windowed.filter((t) => Boolean(t.handedOffAt)).length,
  };
}

export type DayBucket = { key: string; label: string; total: number; spam: number; needsReview: number; handled: number; auto: number; confidence: number; hoursSaved: number; urgent: number };

function dayKey(ms: number, tzOffsetMin: number): string {
  return new Date(ms + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One bucket per day for the last `days` days (oldest first), zero-filled. tzOffsetMin = minutes east of UTC. */
export function dailyVolume(threads: EmailThread[], days: number, now: number, tzOffsetMin = 0): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const ms = now - i * DAY_MS;
    const key = dayKey(ms, tzOffsetMin);
    const d = new Date(ms + tzOffsetMin * 60_000);
    const b: DayBucket = {
      key,
      label: days <= 8 ? `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      total: 0,
      spam: 0,
      needsReview: 0,
      handled: 0,
      auto: 0,
      confidence: 0,
      hoursSaved: 0,
      urgent: 0,
    };
    buckets.push(b);
    index.set(key, b);
  }
  for (const t of threads) {
    if (!inWindow(t, days, now)) continue;
    const ms = Date.parse(t.receivedAt || t.createdAt);
    const b = index.get(dayKey(ms, tzOffsetMin));
    if (!b) continue;
    b.total += 1;
    b.confidence += t.aiConfidence;
    if (t.urgencyScore >= 80 || t.sentiment === "urgent") b.urgent += 1;
    if (isAutoHandled(t)) b.auto += 1;
    if (isSpamBlocked(t)) b.spam += 1;
    else if (t.needsReview) b.needsReview += 1;
    else b.handled += 1;
  }
  for (const b of buckets) {
    b.confidence = b.total ? Math.round(b.confidence / b.total) : 0;
    b.hoursSaved = Math.round((estimateMinutesSaved(b.spam, b.auto) / 60) * 10) / 10;
  }
  return buckets;
}

export const HEAT_ROWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const HEAT_COLUMNS = ["00", "03", "06", "09", "12", "15", "18", "21"] as const;

/** weekday x 3-hour block counts, in the viewer's timezone (tzOffsetMin = minutes east of UTC). */
export function hourDayMatrix(threads: EmailThread[], tzOffsetMin = 0, windowDays?: number, now = Date.now()): number[][] {
  const grid = HEAT_ROWS.map(() => HEAT_COLUMNS.map(() => 0));
  for (const t of threads) {
    if (!inWindow(t, windowDays, now)) continue;
    const ms = Date.parse(t.receivedAt || t.createdAt);
    if (!Number.isFinite(ms)) continue;
    const d = new Date(ms + tzOffsetMin * 60_000);
    const row = (d.getUTCDay() + 6) % 7;
    grid[row][Math.floor(d.getUTCHours() / 3)] += 1;
  }
  return grid;
}

export const CONFIDENCE_BINS = ["<50", "50-59", "60-69", "70-79", "80-89", "90-100"] as const;

export function confidenceHistogram(values: readonly number[]): { label: string; value: number }[] {
  const counts = CONFIDENCE_BINS.map(() => 0);
  for (const raw of values) {
    const v = Math.max(0, Math.min(100, Math.round(raw)));
    counts[v < 50 ? 0 : v >= 90 ? 5 : Math.floor(v / 10) - 4] += 1;
  }
  return CONFIDENCE_BINS.map((label, i) => ({ label, value: counts[i] }));
}

export function urgencyHistogram(values: readonly number[]): { label: string; value: number }[] {
  const labels = ["0-19", "20-39", "40-59", "60-79", "80-100"];
  const counts = labels.map(() => 0);
  for (const raw of values) {
    const v = Math.max(0, Math.min(100, Math.round(raw)));
    counts[Math.min(4, Math.floor(v / 20))] += 1;
  }
  return labels.map((label, i) => ({ label, value: counts[i] }));
}

export function statusLabel(status: ThreadStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "review":
      return "Needs review";
    case "routed":
      return "Routed";
    case "sent":
      return "Reply sent";
    case "blocked":
      return "Blocked";
    case "archived":
      return "Archived";
  }
}

export function categoryName(category: ThreadCategory): string {
  switch (category) {
    case "action_required":
      return "Action required";
    case "fyi":
      return "FYI";
    case "meeting":
      return "Meeting";
    case "spam":
      return "Spam";
  }
}

/** Fixed palette so a category/status keeps its colour on every page. Violet is the lead accent. */
export const CATEGORY_COLOR: Record<ThreadCategory, string> = {
  action_required: "#8b5cf6",
  meeting: "#38bdf8",
  fyi: "#64748b",
  spam: "#f87171",
};

export const STATUS_COLOR: Record<ThreadStatus, string> = {
  open: "#8b5cf6",
  review: "#fbbf24",
  routed: "#38bdf8",
  sent: "#34d399",
  blocked: "#f87171",
  archived: "#64748b",
};

export function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

/** Turns an AiActionLog row into plain English. Raw JSON patches (e.g. {"isRead":true}) never reach the UI. */
export function describeLogDecision(log: Pick<AiActionLog, "actionType" | "aiDecision">): string {
  const raw = (log.aiDecision ?? "").trim();
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const parts: string[] = [];
      if (obj.isRead === true) parts.push("Marked as read");
      if (obj.isRead === false) parts.push("Marked as unread");
      if (obj.isStarred === true) parts.push("Starred");
      if (obj.isStarred === false) parts.push("Unstarred");
      if (typeof obj.status === "string") parts.push(`Status set to ${obj.status}`);
      if (typeof obj.category === "string") parts.push(`Category set to ${String(obj.category).replace(/_/g, " ")}`);
      if (typeof obj.routeTo === "string") parts.push(`Routed to ${obj.routeTo}`);
      if (typeof obj.draftReply === "string") parts.push("Draft reply edited");
      if (typeof obj.draftTone === "string") parts.push(`Tone set to ${obj.draftTone}`);
      if (obj.needsReview === false) parts.push("Cleared from review");
      if (obj.needsReview === true) parts.push("Sent to review");
      if (parts.length) return parts.join(" · ");
      return `${actionName(log.actionType)} (${Object.keys(obj).length} field${Object.keys(obj).length === 1 ? "" : "s"} changed)`;
    } catch {
      return actionName(log.actionType);
    }
  }
  const triage = /^(\w+)\/(\w+) score=(\d+)$/.exec(raw);
  if (triage) return `Classified as ${actionName(triage[1])} · ${triage[2]} tone · urgency ${triage[3]}`;
  const snooze = /^until (.+)$/.exec(raw);
  if (snooze) return `Snoozed until ${new Date(snooze[1]).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  return raw || actionName(log.actionType);
}

export function actionName(actionType: string): string {
  const t = actionType.replace(/[_-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Action";
}
