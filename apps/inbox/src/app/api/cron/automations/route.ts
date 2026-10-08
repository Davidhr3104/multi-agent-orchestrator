import { dueRun } from "@helix/core/automations";
import { checkCronAuth } from "@/lib/cron-auth";
import { validationContext } from "@/lib/automations/catalog";
import { runAutomation } from "@/lib/automations/runner";
import { realDeps } from "@/lib/automations/senders";
import { doneKeys, recordRun, revalidateAll } from "@/lib/automations/service";
import { automationAccess, deskConnections } from "@/lib/automations/storage";
import { deskStatus } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Runs every automation that is due. Call it every few minutes (Vercel cron or any scheduler with the
 * CRON_SECRET bearer). Each scheduled run has an idempotency key, so a repeated call never sends twice, and
 * a run missed by more than the catch-up window is recorded as expired instead of being sent late.
 * A demo desk has nothing server-side to run: its automations live in the visitor's cookie.
 */
export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const status = await deskStatus();
  if (status.mode === "demo") return Response.json({ skipped: "demo desk: automations live in the visitor's browser, nothing to run here", ran: 0 });

  const access = automationAccess(req);
  const loaded = await access.load();
  let state = revalidateAll(loaded, validationContext(deskConnections(), loaded.timezone), new Date());
  const deps = await realDeps();
  const now = deps.now();
  const results: { id: string; key: string; status: string; error?: string }[] = [];

  for (const spec of state.automations) {
    const due = dueRun(spec, doneKeys(state), now);
    if (!due) continue;
    if (due.state === "expired") {
      const finished = now.toISOString();
      state = recordRun(state, {
        id: `run-${now.getTime().toString(36)}-${spec.id}`,
        automationId: spec.id,
        key: due.key,
        scheduledFor: due.scheduledFor,
        startedAt: finished,
        finishedAt: finished,
        status: "expired",
        trigger: "schedule",
        preview: false,
        error: "Missed its window (the scheduler did not run in time), so it was not sent late.",
      });
      results.push({ id: spec.id, key: due.key, status: "expired" });
      continue;
    }
    const run = await runAutomation(spec, { trigger: "schedule", scheduledFor: due.scheduledFor }, deps);
    state = recordRun(state, run);
    results.push({ id: spec.id, key: due.key, status: run.status, error: run.error });
  }

  await access.save(state);
  const failed = results.filter((r) => r.status === "failed").length;
  // A failed run is a 500 so the cron's own monitoring sees it; the details are also in the history.
  return Response.json({ ran: results.length, failed, results }, { status: failed ? 500 : 200 });
}
