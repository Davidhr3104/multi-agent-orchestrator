import { fetchGmailInbox, fetchGmailInboxForAccount, type GmailIngest } from "@/lib/gmail";
import { ingestMessage, listAllThreads, listThreadMessages, patchMessage } from "@/lib/store";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";
import { requireOperator } from "@helix/core/operator";
import { shouldClearFollowup } from "@helix/core/inbox/followup";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  const connected = accounts.filter((a) => a.isConnected && a.accessToken);

  // No OAuth accounts at all — fall back to the legacy single pasted-token
  // path (fetchGmailInbox already handles that fallback internally).
  const batches =
    connected.length > 0
      ? await Promise.all(connected.map((a) => fetchGmailInboxForAccount(a.id)))
      : [await fetchGmailInbox()];

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
    return Response.json({ error: errors.map((e) => `${e.emailAddress ?? "unknown"}: ${e.error}`).join("; ") }, { status: 502 });
  }

  const existing = await listAllThreads();
  const byExternalThreadId = new Map(existing.filter((t) => t.externalThreadId).map((t) => [t.externalThreadId, t]));
  const seen = new Set(existing.map((t) => t.externalThreadId).filter(Boolean));
  const ingested = [];
  for (const row of rows) {
    if (seen.has(row.externalThreadId)) {
      // This Gmail thread already exists in our store. `ingestMessage()` only
      // ever creates brand-new threads, so there is currently no code path
      // that appends this row as a new message onto the existing thread —
      // sync just skips it as already-seen. What we CAN do here is detect a
      // genuine, NEW inbound reply landing on a thread we're still waiting
      // on, and clear lastReplySentAt so it drops out of the followup queue.
      //
      // C1 fix: Gmail's `in:inbox newer_than:14d` query keeps re-listing the
      // customer's ORIGINAL inbound message on every sync (our reply is
      // labeled SENT, not INBOX, so it rarely re-appears) — that original
      // message genuinely has a different sender than us, so a sender-only
      // echo-guard would clear lastReplySentAt on every single sync, not
      // just when a real new reply arrives. shouldClearFollowup() adds a
      // novelty check (has this exact gmailMessageId been recorded before
      // for this thread?) on top of the sender check to stop that regression.
      const thread = byExternalThreadId.get(row.externalThreadId);
      if (thread) {
        const history = await listThreadMessages(thread.id);
        const alreadyKnown = history.some((m) => m.gmailMessageId === row.gmailMessageId);
        // Both sides are verified bare, lowercase-comparable addresses, so no
        // display-name stripping is needed here: row.fromEmail comes from
        // parseFrom() in gmail.ts, which strips any "Display Name <addr>"
        // wrapper and returns only the bare address in `.email` (see the
        // `angle` branch there). thread.toEmail is either DEFAULT_TO_EMAIL
        // (types.ts — a hardcoded bare literal, "triage@company.io") or an
        // EmailAccount.emailAddress populated by fetchGmailAddress() in
        // gmail-oauth.ts, which reads `emailAddress` straight off Gmail's
        // users.getProfile response — a bare address by construction, never a
        // header-style string.
        if (
          shouldClearFollowup(thread, { fromEmail: row.fromEmail, alreadyKnown })
        ) {
          // I4: a genuine inbound reply doesn't just clear the followup flag —
          // it reopens the thread into the normal review queue, same as any
          // other inbound message, so it doesn't sit invisibly as "sent".
          await patchMessage(
            thread.id,
            {
              lastReplySentAt: undefined,
              status: "review",
              needsReview: true,
            },
            { actionType: "sync:inbound_reply_clears_followup", humanOverride: false }
          );
        }
      }
      continue;
    }
    seen.add(row.externalThreadId);
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
      })
    );
  }
  return Response.json({
    imported: ingested.length,
    scanned: rows.length,
    accountsSynced: connected.length || (errors.length === 0 ? 1 : 0),
    errors: errors.length > 0 ? errors : undefined,
  });
}
