import type { EmailThread, ThreadCategory, ThreadSentiment, ThreadStatus } from "@/lib/types";

/**
 * Deterministic 14-day demo history for the sample desk. It exists so charts have a believable shape
 * (weekday rhythm, business-hours peaks, quiet weekends) instead of 8 threads in one afternoon.
 * Same `now` -> same output. Every row is a closed thread (sent / routed / archived / blocked) so the
 * live queue and every Ask AI action still operate on the 8 featured demo threads only.
 * The desk labels all of it "Demo". Sender names never repeat a featured thread's sender, so "Snooze Priya Shah's email" stays unambiguous.
 */

export const DEMO_HISTORY_DAYS = 14;
export const DEMO_HISTORY_PREFIX = "demo-h-";

export type HistoryThread = Pick<
  EmailThread,
  | "id"
  | "fromName"
  | "fromEmail"
  | "subject"
  | "body"
  | "category"
  | "sentiment"
  | "urgencyScore"
  | "aiConfidence"
  | "routeTo"
  | "draftReply"
  | "status"
  | "reasoning"
  | "needsReview"
  | "leadIntent"
  | "receivedAt"
  | "createdAt"
  | "updatedAt"
  | "handedOffAt"
>;

export type HistoryLog = {
  id: string;
  threadId: string;
  actionType: string;
  aiDecision: string;
  confidenceScore: number;
  humanOverride: boolean;
  createdAt: string;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SENDERS: Array<{ name: string; email: string; org: string }> = [
  { name: "Grace Whitfield", email: "grace.whitfield@halcyoncap.com", org: "Halcyon Capital" },
  { name: "Ben Alvarado", email: "ben@orbitaltravel.co", org: "Orbital Travel" },
  { name: "Nadia Ferreira", email: "nadia@brightlineparts.com", org: "Brightline Parts" },
  { name: "Tom Okafor", email: "tom.okafor@meridianlegal.com", org: "Meridian Legal" },
  { name: "Sofia Lindqvist", email: "sofia@northbridge.vc", org: "Northbridge Ventures" },
  { name: "Raj Patel", email: "raj.patel@cobaltsystems.io", org: "Cobalt Systems" },
  { name: "Hannah Brooks", email: "hannah@brooksandco.com", org: "Brooks & Co" },
  { name: "Jonas Keller", email: "jonas@greenleaf.co", org: "Greenleaf" },
  { name: "Amara Njoku", email: "amara@techventures.com", org: "Tech Ventures" },
  { name: "Owen Gallagher", email: "owen.g@harborfinance.com", org: "Harbor Finance" },
  { name: "Mei Tanaka", email: "mei.tanaka@kitsuneworks.jp", org: "Kitsune Works" },
  { name: "Carlos Mendes", email: "carlos@atlasfreight.com", org: "Atlas Freight" },
];

type Template = { subject: (org: string, n: number) => string; body: string; route: string; sentiment: ThreadSentiment; urgency: [number, number] };

const TEMPLATES: Record<ThreadCategory, Template[]> = {
  action_required: [
    { subject: (o) => `Contract redline for review — ${o}`, body: "Attached is the latest redline. Legal needs your sign-off before Friday so we can countersign.", route: "Executive · Sarah", sentiment: "neutral", urgency: [55, 90] },
    { subject: (_o, n) => `Invoice #${4400 + n} — payment reminder`, body: "Friendly reminder that this invoice is due on the 5th. Let us know if you need a copy resent.", route: "Finance · Ops", sentiment: "neutral", urgency: [30, 60] },
    { subject: () => "Approval needed: Q4 travel budget", body: "Travel is asking for approval on the Q4 budget before they can book the offsite flights.", route: "Executive · Sarah", sentiment: "neutral", urgency: [50, 80] },
    { subject: (o) => `Signature needed: mutual NDA with ${o}`, body: "Please sign the attached NDA so we can share the data room today.", route: "Legal · Ops", sentiment: "positive", urgency: [60, 88] },
  ],
  meeting: [
    { subject: (o) => `Intro call — ${o}`, body: "Could we find 30 minutes next week to introduce the teams? Happy to work around your calendar.", route: "Executive · Sarah", sentiment: "positive", urgency: [40, 75] },
    { subject: () => "Can we move Thursday's sync?", body: "Something came up on my side. Could we shift Thursday's sync to Friday morning?", route: "Executive · Sarah", sentiment: "neutral", urgency: [35, 65] },
    { subject: (o) => `Board prep — agenda from ${o}`, body: "Sharing the draft agenda for next week's board prep. Let me know what to add.", route: "Executive · Sarah", sentiment: "neutral", urgency: [45, 70] },
  ],
  fyi: [
    { subject: () => "Monthly performance report attached", body: "Attached the monthly performance metrics. Nothing urgent, just for your records.", route: "Archive", sentiment: "positive", urgency: [8, 30] },
    { subject: () => "Notes from yesterday's call", body: "Short recap of what we agreed on, for the record. No reply needed.", route: "Archive", sentiment: "neutral", urgency: [10, 35] },
    { subject: () => "This week in industry news", body: "Your weekly digest of headlines. Unsubscribe any time.", route: "Archive", sentiment: "neutral", urgency: [4, 22] },
  ],
  spam: [
    { subject: () => "FREE NFT DROP CLICK NOW", body: "Claim your complimentary mint before the whitelist closes in 15 minutes!!!", route: "Spam", sentiment: "neutral", urgency: [2, 8] },
    { subject: () => "Your account has been suspended!!!", body: "Verify your password immediately at the link below or lose access.", route: "Spam", sentiment: "neutral", urgency: [2, 8] },
    { subject: () => "You have won a gift card", body: "Congratulations! Click to claim your reward today only.", route: "Spam", sentiment: "neutral", urgency: [2, 8] },
  ],
};

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function between(rand: () => number, lo: number, hi: number): number {
  return Math.round(lo + rand() * (hi - lo));
}

/** UTC hour weights: a morning peak, an afternoon peak, little overnight. Reads as US/LatAm business hours. */
const HOUR_WEIGHTS = [0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.8, 1.4, 2.2, 3, 3, 2.4, 1.4, 1.6, 2.4, 2.6, 2.0, 1.2, 0.8, 0.5, 0.4, 0.3, 0.2, 0.2];

function pickHour(rand: () => number): number {
  const total = HOUR_WEIGHTS.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let h = 0; h < 24; h++) {
    r -= HOUR_WEIGHTS[h];
    if (r <= 0) return h;
  }
  return 14;
}

export function buildDemoHistory(now: number): { threads: HistoryThread[]; logs: HistoryLog[] } {
  const rand = mulberry32(20_260_615);
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const threads: HistoryThread[] = [];
  const logs: HistoryLog[] = [];
  let n = 0;

  for (let d = DEMO_HISTORY_DAYS - 1; d >= 0; d--) {
    const day = new Date(dayStart - d * 86_400_000);
    const dow = day.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    // Rhythm: busy early-week, lighter Friday, quiet weekend.
    const base = weekend ? 1 : dow === 1 || dow === 2 ? 7 : dow === 5 ? 4 : 6;
    const count = Math.max(0, base + between(rand, -1, 2));
    for (let k = 0; k < count; k++) {
      const hour = pickHour(rand);
      const at = dayStart - d * 86_400_000 + hour * 3_600_000 + between(rand, 0, 59) * 60_000;
      // The 8 featured threads own the last ~8 hours; history never overlaps them or sits in the future.
      if (at > now - 9 * 3_600_000) continue;

      const roll = rand();
      const category: ThreadCategory = roll < 0.4 ? "action_required" : roll < 0.62 ? "meeting" : roll < 0.84 ? "fyi" : "spam";
      const tpl = pick(rand, TEMPLATES[category]);
      const sender = category === "spam" ? { name: "Promo Blast", email: `noreply@promo${between(rand, 1, 4)}.example.net`, org: "Promo" } : pick(rand, SENDERS);
      n += 1;
      const id = `${DEMO_HISTORY_PREFIX}${String(n).padStart(3, "0")}`;
      const urgency = between(rand, tpl.urgency[0], tpl.urgency[1]);
      const confidence =
        category === "spam" ? between(rand, 95, 99) : category === "fyi" ? between(rand, 86, 98) : between(rand, 58, 96);
      const needsReview = category !== "spam" && category !== "fyi" && (confidence < 72 || urgency >= 85 || rand() < 0.12);
      // Replies only go out after a person approves them, so only reviewed rows can be "sent".
      const status: ThreadStatus =
        category === "spam" ? "blocked" : category === "fyi" ? "archived" : needsReview ? "sent" : "routed";
      const leadIntent = category === "action_required" && rand() < 0.14;
      const iso = new Date(at).toISOString();
      const done = new Date(at + between(rand, 4, 140) * 60_000).toISOString();
      threads.push({
        id,
        fromName: sender.name,
        fromEmail: sender.email,
        subject: tpl.subject(sender.org, n),
        body: tpl.body,
        category,
        sentiment: tpl.sentiment,
        urgencyScore: urgency,
        aiConfidence: confidence,
        routeTo: tpl.route,
        draftReply: "",
        status,
        reasoning:
          category === "spam"
            ? "Obvious spam with urgency tactics"
            : needsReview
              ? "Reviewed by a person before sending"
              : "High-confidence match, handled without review",
        needsReview: false,
        leadIntent,
        receivedAt: iso,
        createdAt: iso,
        updatedAt: done,
        handedOffAt: leadIntent && status !== "blocked" ? done : undefined,
      });
      // `needsReview` is kept false on closed history rows: it means "waiting on a person right now".
      // Whether a person was involved is recorded in the audit log (humanOverride).
      logs.push({
        id: `demo-log-${String(n).padStart(3, "0")}`,
        threadId: id,
        actionType: category === "spam" ? "block" : needsReview ? "approve" : "triage",
        aiDecision:
          category === "spam"
            ? "Blocked as spam"
            : needsReview
              ? `Reply approved by a person · routed to ${tpl.route}`
              : `Classified as ${category.replace("_", " ")} · routed to ${tpl.route}`,
        confidenceScore: confidence,
        humanOverride: needsReview,
        createdAt: done,
      });
    }
  }
  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { threads, logs };
}
