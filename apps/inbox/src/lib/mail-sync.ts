import { isClaudeConfigured } from "@helix/core";
import { shouldClearFollowup } from "@helix/core/inbox/followup";
import { fetchGmailInbox, fetchGmailInboxForAccount, fetchGmailSentSamples, type GmailIngest } from "@/lib/gmail";
import { ingestMessage, listAllThreads, listThreadMessages, patchMessage, type InboxMessage } from "@/lib/store";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";

/** Upper bound on new threads the cron triages per run, which also caps Claude spend per run. */
export const CRON_MAX_NEW_PER_RUN = 10;

export type SyncOutcome =
  | { ok: false; error: string }
  | {
      ok: true;
      imported: number;
      scanned: number;
      skippedOverLimit: number;
      accountsSynced: number;
      ingested: InboxMessage[];
      errors?: { emailAddress: string | null; error: string }[];
    };

/**
 * Pulls recent Gmail into the desk: new threads are triaged (Claude when configured, keyword rules
 * otherwise) and get a draft. Nothing is ever sent from here. `maxNew` caps how many new threads
 * are triaged per run so an automated run cannot spend without bound.
 */
export async function syncMailboxes(opts: { maxNew?: number } = {}): Promise<SyncOutcome> {
  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  const connected = accounts.filter((a) => a.isConnected && a.accessToken);

  // No OAuth accounts at all — fall back to the legacy single pasted-token
  // path (fetchGmailInbox already handles that fallback internally).
  const batches =
    connected.length > 0 ? await Promise.all(connected.map((a) => fetchGmailInboxForAccount(a.id))) : [await fetchGmailInbox()];

  const errors: { emailAddress: string | null; error: string }[] = [];
  const rows: GmailIngest[] = [];
  batches.forEach((batch, i) => {
    if ("error" in batch) {
      errors.push({ emailAddress: connected[i]?.emailAddress ?? null, error: batch.error });
      return;
    }
    rows.push(...batch);
  });

  if (rows.length === 0 && errors.length > 0) {
    // Every connected mailbox failed to sync — surface it, don't report a silent "0 imported".
    return { ok: false, error: errors.map((e) => `${e.emailAddress ?? "unknown"}: ${e.error}`).join("; ") };
  }

  const existing = await listAllThreads();
  const byExternalThreadId = new Map(existing.filter((t) => t.externalThreadId).map((t) => [t.externalThreadId, t]));
  const seen = new Set(existing.map((t) => t.externalThreadId).filter(Boolean));
  const toneByAccount = new Map<string, string[]>();
  const maxNew = opts.maxNew ?? Number.POSITIVE_INFINITY;
  const ingested: InboxMessage[] = [];
  let skippedOverLimit = 0;
  for (const row of rows) {
    if (seen.has(row.externalThreadId)) {
      // Existing thread: only detect a genuine new inbound reply on a thread we're waiting on
      // (shouldClearFollowup adds the novelty check so the re-listed original doesn't count).
      const thread = byExternalThreadId.get(row.externalThreadId);
      if (thread) {
        const history = await listThreadMessages(thread.id);
        const alreadyKnown = history.some((m) => m.gmailMessageId === row.gmailMessageId);
        if (shouldClearFollowup(thread, { fromEmail: row.fromEmail, alreadyKnown })) {
          await patchMessage(
            thread.id,
            { lastReplySentAt: undefined, status: "review", needsReview: true },
            { actionType: "sync:inbound_reply_clears_followup", humanOverride: false }
          );
        }
      }
      continue;
    }
    if (ingested.length >= maxNew) {
      skippedOverLimit += 1;
      continue;
    }
    seen.add(row.externalThreadId);
    const accountKey = row.emailAccountId ?? "";
    if (isClaudeConfigured() && !toneByAccount.has(accountKey)) {
      toneByAccount.set(accountKey, await fetchGmailSentSamples(3, row.emailAccountId));
    }
    ingested.push(
      await ingestMessage({
        fromName: row.fromName,
        fromEmail: row.fromEmail,
        subject: row.subject,
        body: row.body,
        externalThreadId: row.externalThreadId,
        gmailMessageId: row.gmailMessageId,
        rfcMessageId: row.rfcMessageId,
        emailAccountId: row.emailAccountId,
        toneSamples: toneByAccount.get(accountKey),
      })
    );
  }
  return {
    ok: true,
    imported: ingested.length,
    scanned: rows.length,
    skippedOverLimit,
    accountsSynced: connected.length || (errors.length === 0 ? 1 : 0),
    ingested,
    errors: errors.length > 0 ? errors : undefined,
  };
}
