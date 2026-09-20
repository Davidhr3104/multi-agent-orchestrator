import type { EmailThread, ThreadCategory } from "@/lib/types";

export type SlaBucketId = "vip" | "urgent" | "action" | "meeting" | "fyi";

export type SlaBucket = {
  id: SlaBucketId;
  label: string;
  targetMin: number;
  open: number;
  breach: number;
  atRisk: number;
};

export type InboxSlaSummary = {
  openCount: number;
  breachCount: number;
  atRiskCount: number;
  medianOpenAgeMin: number | null;
  hoursSaved: number;
  minutesSaved: number;
  spamBlocked: number;
  autoHandled: number;
  worstThreadId: string | null;
  worstSubject: string | null;
  worstAgeMin: number;
  worstTargetMin: number;
  buckets: SlaBucket[];
};

const TARGETS: Record<SlaBucketId, number> = {
  vip: 30,
  urgent: 60,
  action: 60,
  meeting: 240,
  fyi: 1440,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function slaBucketFor(
  thread: EmailThread,
  vipSenders: string[]
): SlaBucketId | null {
  if (thread.category === "spam" || thread.status === "blocked") return null;
  const vip = vipSenders.some((v) => v.toLowerCase() === thread.fromEmail.toLowerCase());
  if (vip) return "vip";
  if (thread.sentiment === "urgent" || thread.urgencyScore >= 80) return "urgent";
  if (thread.category === "meeting") return "meeting";
  if (thread.category === "fyi") return "fyi";
  if (thread.category === "action_required") return "action";
  return "action";
}

/** Age in minutes from receivedAt (or createdAt) to `now`. */
export function threadAgeMin(thread: EmailThread, now = Date.now()): number {
  const start = Date.parse(thread.receivedAt || thread.createdAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, (now - start) / 60_000);
}

function isOpenForSla(thread: EmailThread): boolean {
  return thread.status === "open" || thread.status === "review";
}

/**
 * Desk-level SLA + hours-saved story for Inbox.
 * Hours saved is an ops estimate: spam blocked + auto-handled threads without HITL.
 */
export function summarizeInboxSla(
  threads: EmailThread[],
  opts?: { vipSenders?: string[]; now?: number }
): InboxSlaSummary {
  const vipSenders = opts?.vipSenders ?? [];
  const now = opts?.now ?? Date.now();

  const bucketMap: Record<SlaBucketId, SlaBucket> = {
    vip: { id: "vip", label: "VIP (30m)", targetMin: TARGETS.vip, open: 0, breach: 0, atRisk: 0 },
    urgent: {
      id: "urgent",
      label: "Urgent (1h)",
      targetMin: TARGETS.urgent,
      open: 0,
      breach: 0,
      atRisk: 0,
    },
    action: {
      id: "action",
      label: "Action (1h)",
      targetMin: TARGETS.action,
      open: 0,
      breach: 0,
      atRisk: 0,
    },
    meeting: {
      id: "meeting",
      label: "Meeting (4h)",
      targetMin: TARGETS.meeting,
      open: 0,
      breach: 0,
      atRisk: 0,
    },
    fyi: { id: "fyi", label: "FYI (24h)", targetMin: TARGETS.fyi, open: 0, breach: 0, atRisk: 0 },
  };

  const openAges: number[] = [];
  let breachCount = 0;
  let atRiskCount = 0;
  let worst: { thread: EmailThread; age: number; target: number } | null = null;

  for (const thread of threads) {
    const bucketId = slaBucketFor(thread, vipSenders);
    if (!bucketId || !isOpenForSla(thread)) continue;
    const age = threadAgeMin(thread, now);
    const target = TARGETS[bucketId];
    const bucket = bucketMap[bucketId];
    bucket.open += 1;
    openAges.push(age);

    if (age > target) {
      bucket.breach += 1;
      breachCount += 1;
    } else if (age > target * 0.75) {
      bucket.atRisk += 1;
      atRiskCount += 1;
    }

    const overshoot = age - target;
    if (!worst || overshoot > worst.age - worst.target) {
      worst = { thread, age, target };
    }
  }

  const spamBlocked = threads.filter(
    (t) => t.category === "spam" || t.status === "blocked"
  ).length;
  const autoHandled = threads.filter(
    (t) =>
      !t.needsReview &&
      t.category !== "spam" &&
      (t.status === "routed" || t.status === "sent" || t.status === "archived" || t.status === "open")
  ).length;

  // Ops estimate: ~3 min per spam blocked, ~5 min per auto-handled thread
  const minutesSaved = spamBlocked * 3 + autoHandled * 5;

  return {
    openCount: openAges.length,
    breachCount,
    atRiskCount,
    medianOpenAgeMin: median(openAges.map((n) => Math.round(n))),
    hoursSaved: round1(minutesSaved / 60),
    minutesSaved,
    spamBlocked,
    autoHandled,
    worstThreadId: worst?.thread.id ?? null,
    worstSubject: worst?.thread.subject ?? null,
    worstAgeMin: worst ? Math.round(worst.age) : 0,
    worstTargetMin: worst?.target ?? 0,
    buckets: Object.values(bucketMap),
  };
}

export function categoryTargetLabel(category: ThreadCategory): string {
  if (category === "spam") return "—";
  if (category === "meeting") return "4h";
  if (category === "fyi") return "24h";
  return "1h";
}
