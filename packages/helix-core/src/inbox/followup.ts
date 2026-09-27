/**
 * Shared predicate for "should this inbound signal clear `lastReplySentAt`
 * (and thus reopen the thread into review)?" — used by BOTH the Gmail sync
 * echo-guard (sync/route.ts) and the .eml ingest path (store.ts's
 * appendEmlToThread), so there is exactly one tested rule for this decision
 * instead of two hand-written copies that can drift.
 *
 * Root cause this exists to fix (C1): Gmail's message list for
 * `in:inbox newer_than:14d` keeps re-listing the customer's ORIGINAL inbound
 * message on every sync (our reply is labeled SENT, not INBOX, so it rarely
 * re-appears) — that original message genuinely has `fromEmail !== toEmail`,
 * so a sender-only echo-guard clears `lastReplySentAt` on every sync, not
 * just when a real new reply arrives. The fix adds two independent checks on
 * top of the sender check: novelty (`alreadyKnown`) and, when available,
 * recency (`sentAt` after `lastReplySentAt`).
 */
export function shouldClearFollowup(
  thread: { lastReplySentAt?: string; toEmail: string },
  msg: { fromEmail: string; alreadyKnown: boolean; sentAt?: string }
): boolean {
  if (!thread.lastReplySentAt) return false;
  if (msg.fromEmail.toLowerCase() === thread.toEmail.toLowerCase()) return false;
  if (msg.alreadyKnown) return false;
  if (msg.sentAt && Date.parse(msg.sentAt) <= Date.parse(thread.lastReplySentAt)) return false;
  return true;
}
