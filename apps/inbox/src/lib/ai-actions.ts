import type { DeskActionRegistry } from "@helix/core";
import type { EmailThread, ThreadCategory, ThreadStatus } from "@/lib/types";
import { sendThreadReply } from "@/lib/reply-send";
import { currentDeskMode, getThread, patchMessage, regenerateSmartReply, snoozeThread } from "@/lib/store";

/**
 * What Helix AI may do on the Inbox desk, and when it may do it alone.
 *   draft_reply     write a draft, nothing is sent               -> auto (+Undo)
 *   snooze_threads  hide until later                             -> auto (+Undo)
 *   archive_threads move out of the queue                        -> auto unless urgent / awaiting review (+Undo)
 *   route_threads   hand to the responsible person               -> auto unless awaiting review (+Undo)
 *   send_reply      emails a real person, cannot be recalled     -> always ask
 * `touched` lets the route write the changes into the desk cookie, which is how Inbox survives serverless.
 */

export type InboxCtx = { actor: string; touched: Set<string> };

const STATUSES: ThreadStatus[] = ["open", "review", "routed", "sent", "blocked", "archived"];
const CATEGORIES: ThreadCategory[] = ["action_required", "fyi", "meeting", "spam"];
const BULK_LIMIT = 5;
const URGENT = 80;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const names = (l: string[]) => l.join(", ");

type ThreadSnapshot = {
  status: ThreadStatus;
  needsReview: boolean;
  isRead: boolean;
  isStarred: boolean;
  snoozeUntil: string | null;
  draftReply: string;
  routeTo: string;
  category: ThreadCategory;
  lastReplySentAt: string | null;
};

function isSnapshot(d: unknown): d is ThreadSnapshot {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    STATUSES.includes(o.status as ThreadStatus) &&
    typeof o.needsReview === "boolean" &&
    typeof o.isRead === "boolean" &&
    typeof o.isStarred === "boolean" &&
    (o.snoozeUntil === null || typeof o.snoozeUntil === "string") &&
    typeof o.draftReply === "string" &&
    typeof o.routeTo === "string" &&
    CATEGORIES.includes(o.category as ThreadCategory) &&
    (o.lastReplySentAt === null || typeof o.lastReplySentAt === "string")
  );
}

async function snapshot(id: string): Promise<ThreadSnapshot | null> {
  const t = await getThread(id);
  if (!t) return null;
  return {
    status: t.status,
    needsReview: t.needsReview,
    isRead: t.isRead,
    isStarred: t.isStarred,
    snoozeUntil: t.snoozeUntil,
    draftReply: t.draftReply,
    routeTo: t.routeTo,
    category: t.category,
    lastReplySentAt: t.lastReplySentAt ?? null,
  };
}

async function restoreThread(id: string, data: unknown, ctx: InboxCtx): Promise<boolean> {
  if (!isSnapshot(data)) throw new Error("Invalid undo data");
  const current = await getThread(id);
  if (!current) return false;
  // A reply that really went out cannot be recalled — say so instead of pretending it was undone.
  if (current.status === "sent" && data.status !== "sent" && currentDeskMode() === "live") {
    throw new Error("This reply was already emailed and cannot be undone.");
  }
  const restored = await patchMessage(id, { ...data, lastReplySentAt: data.lastReplySentAt ?? undefined });
  ctx.touched.add(id);
  return restored !== null;
}

async function threads(ids: string[]): Promise<EmailThread[]> {
  return (await Promise.all(ids.map((id) => getThread(id)))).filter((t): t is EmailThread => t !== null);
}

async function gate(ids: string[], reasonsFor: (rows: EmailThread[]) => string[]) {
  const rows = await threads(ids);
  const reasons = reasonsFor(rows);
  if (rows.length !== ids.length) reasons.push("A thread no longer exists");
  if (rows.length > BULK_LIMIT) reasons.push(`Bulk change (${rows.length} threads)`);
  return reasons.length ? { level: "confirm" as const, reasons } : { level: "auto" as const, reasons };
}

const label = (t: EmailThread) => t.fromName || t.fromEmail;

export const inboxActions: DeskActionRegistry<InboxCtx> = {
  draft_reply: {
    name: "draft_reply",
    assess: (ids) => gate(ids, () => []),
    snapshot,
    apply: async (id, _p, ctx) => {
      const m = await regenerateSmartReply(id);
      if (m) ctx.touched.add(id);
      return m !== null;
    },
    restore: restoreThread,
    resultText: (done, failed) => `Drafted a reply on ${plural(done.length, "thread")} — nothing was sent.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI drafted a reply to ${names(l)}`,
  },

  snooze_threads: {
    name: "snooze_threads",
    assess: (ids) => gate(ids, () => []),
    snapshot,
    apply: async (id, p, ctx) => {
      const m = await snoozeThread(id, typeof p.until === "string" ? p.until : undefined);
      if (m) ctx.touched.add(id);
      return m !== null;
    },
    restore: restoreThread,
    resultText: (done, failed) => `Snoozed ${plural(done.length, "thread")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI snoozed ${names(l)}`,
  },

  archive_threads: {
    name: "archive_threads",
    assess: (ids) =>
      gate(ids, (rows) => {
        const r: string[] = [];
        if (rows.some((t) => t.urgencyScore >= URGENT)) r.push("Includes an urgent thread");
        if (rows.some((t) => t.needsReview)) r.push("A thread is still awaiting human review");
        if (rows.some((t) => t.status === "sent")) r.push("A thread already has a sent reply");
        return r;
      }),
    snapshot,
    apply: async (id, _p, ctx) => {
      const m = await patchMessage(id, { status: "archived", needsReview: false, isRead: true }, { actionType: `ai_archive:${ctx.actor}`, humanOverride: false });
      if (m) ctx.touched.add(id);
      return m !== null;
    },
    restore: restoreThread,
    resultText: (done, failed) => `Archived ${plural(done.length, "thread")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI archived ${names(l)}`,
  },

  route_threads: {
    name: "route_threads",
    assess: (ids) => gate(ids, (rows) => (rows.some((t) => t.needsReview) ? ["A thread is still awaiting human review"] : [])),
    snapshot,
    apply: async (id, _p, ctx) => {
      const m = await patchMessage(id, { status: "routed", needsReview: false, isRead: true }, { actionType: `ai_route:${ctx.actor}`, humanOverride: false });
      if (m) ctx.touched.add(id);
      return m !== null;
    },
    restore: restoreThread,
    resultText: (done, failed) => `Routed ${plural(done.length, "thread")} to the responsible owner.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI routed ${names(l)}`,
  },

  send_reply: {
    name: "send_reply",
    assess: async (ids) => ({ level: "confirm", reasons: [`Emails ${plural(ids.length, "person")}${ids.length === 1 ? "" : " in total"} and cannot be recalled`] }),
    snapshot,
    apply: async (id, _p, ctx) => {
      ctx.touched.add(id);
      if (currentDeskMode() === "demo") {
        // The demo desk has no mailbox: record the send locally and say so, never pretend an email left.
        const m = await patchMessage(id, { status: "sent", needsReview: false, isRead: true, lastReplySentAt: new Date().toISOString() }, { actionType: `send:${ctx.actor}:demo`, humanOverride: true });
        return m !== null;
      }
      const r = await sendThreadReply(id, ctx.actor);
      if (!r.ok) throw new Error(r.error);
      return true;
    },
    restore: restoreThread,
    resultText: (done, failed) =>
      currentDeskMode() === "demo"
        ? `Marked ${plural(done.length, "reply")} as sent. Demo mode: nothing was actually emailed.${failed ? ` ${failed} failed.` : ""}`
        : `Sent ${plural(done.length, "reply")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI sent a reply to ${names(l)}`,
  },
};

export { label as threadLabel };
