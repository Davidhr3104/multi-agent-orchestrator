import { fetchGmailInbox, fetchGmailInboxForAccount, type GmailIngest } from "@/lib/gmail";
import { ingestMessage, listAllThreads } from "@/lib/store";
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
  const seen = new Set(existing.map((t) => t.externalThreadId).filter(Boolean));
  const ingested = [];
  for (const row of rows) {
    if (seen.has(row.externalThreadId)) continue;
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
