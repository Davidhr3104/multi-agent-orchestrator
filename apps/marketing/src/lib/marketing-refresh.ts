import { timingSafeEqual } from "node:crypto";
import { getSecret, windowBounds } from "@helix/core";
import { AD_SOURCES, isSourceConfigured, SOURCE_LABEL, syncAdSource, type SyncResult } from "@/lib/ad-sources";
import { notifySlackWasteReport } from "@/lib/slack";
import { currentDeskMode, upsertSourceSpend } from "@/lib/store";
import { generateWasteReport, type WasteReport } from "@/lib/waste-report";

/**
 * Daily automation: refresh spend from every connected platform, rebuild the waste report and its
 * pause/scale proposals, optionally post to Slack. It never pauses or scales anything — proposals
 * wait for a person to confirm them in the app.
 */

/** Fails closed: without CRON_SECRET the job refuses to run (it calls paid APIs). */
export function cronAuth(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = getSecret("CRON_SECRET");
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET is not set — the daily refresh is disabled." };
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  return { ok: true };
}

export type RefreshResult = {
  ranAt: string;
  mode: "demo" | "live";
  skipped?: string;
  syncs: SyncResult[];
  report: WasteReport | null;
  postedToSlack: boolean;
  appliedChanges: 0;
};

export async function runMarketingRefresh(opts: { slack?: boolean } = {}): Promise<RefreshResult> {
  const ranAt = new Date().toISOString();
  const mode = currentDeskMode();
  if (mode === "demo") {
    return { ranAt, mode, skipped: "Desk is in demo mode — no real spend to refresh.", syncs: [], report: null, postedToSlack: false, appliedChanges: 0 };
  }

  const { from, to } = windowBounds("7d");
  const syncs: SyncResult[] = [];
  for (const source of AD_SOURCES) {
    if (!isSourceConfigured(source)) continue;
    syncs.push(await syncAdSource(source, { since: from, until: to }, upsertSourceSpend));
  }

  const report = await generateWasteReport({ window: "7d", trigger: "cron" });
  const syncLines = syncs.map((s) =>
    s.ok ? `${SOURCE_LABEL[s.source]}: ${s.imported} spend rows refreshed.` : `${SOURCE_LABEL[s.source]}: read failed — ${s.error}`
  );
  if (syncs.length === 0) syncLines.push("No ad platform connected — report uses spend already on the desk (CSV uploads).");

  const postedToSlack = opts.slack === false ? false : await notifySlackWasteReport(report, syncLines);
  return { ranAt, mode, syncs, report, postedToSlack, appliedChanges: 0 };
}
