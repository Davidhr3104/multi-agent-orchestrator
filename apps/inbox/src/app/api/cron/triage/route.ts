import { isClaudeConfigured } from "@helix/core";
import { summarizeAiUsage } from "@/lib/ai-usage";
import { checkCronAuth } from "@/lib/cron-auth";
import { CRON_MAX_NEW_PER_RUN, syncMailboxes } from "@/lib/mail-sync";
import { deskStatus } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled by vercel.json. Pulls new Gmail, triages it and prepares drafts for human review.
 * It never sends anything: every reply still needs a person to press Send.
 */
export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const status = await deskStatus();
  if (status.mode === "demo") {
    return Response.json({ skipped: "demo desk: no mailbox connected, nothing to triage", sent: 0 });
  }

  const before = summarizeAiUsage();
  const r = await syncMailboxes({ maxNew: CRON_MAX_NEW_PER_RUN });
  const after = summarizeAiUsage();
  const usage = {
    estimated: true,
    claudeCalls: after.calls - before.calls,
    inputTokens: after.inputTokens - before.inputTokens,
    outputTokens: after.outputTokens - before.outputTokens,
    estimatedUsd: Number((after.estimatedUsd - before.estimatedUsd).toFixed(6)),
  };
  if (!r.ok) return Response.json({ error: r.error, sent: 0, usage }, { status: 502 });
  return Response.json({
    engine: isClaudeConfigured() ? "claude" : "heuristic",
    imported: r.imported,
    drafted: r.ingested.filter((m) => m.draftReply.trim()).length,
    scanned: r.scanned,
    skippedOverLimit: r.skippedOverLimit,
    accountsSynced: r.accountsSynced,
    errors: r.errors,
    sent: 0,
    usage,
  });
}
