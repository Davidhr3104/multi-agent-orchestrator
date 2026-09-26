import { fetchGmailInbox, fetchGmailInboxForAccount, type GmailIngest } from "@/lib/gmail";
import { ingestMessage, listAllThreads, patchMessage } from "@/lib/store";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";
import { requireOperator } from "@helix/core/operator";

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
      // genuine inbound reply (sender isn't our own mailbox) landing on a
      // thread we're still waiting on, and clear lastReplySentAt so it drops
      // out of the followup queue. Guard against clearing on an echo of our
      // own sent message coming back through sync.
      const thread = byExternalThreadId.get(row.externalThreadId);
      if (
        thread?.lastReplySentAt &&
        row.fromEmail.toLowerCase() !== thread.toEmail.toLowerCase()
      ) {
        await patchMessage(
          thread.id,
          { lastReplySentAt: undefined },
          { actionType: "sync:inbound_reply_clears_followup", humanOverride: false }
        );
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
