import { createHash, timingSafeEqual } from "node:crypto";
import { addReviewDrafts, currentDeskMode, getBrand } from "../store";
import { draftsFromTopPosts } from "./ai-drafts";
import type { FetchLike } from "./config";
import { realPosts, refreshInsights } from "./insights";
import { writeWeeklyReport } from "./weekly-report";

export type CronAuth = "ok" | "no_secret" | "denied";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a secret the route refuses every call. */
export function cronAuth(header: string | null, secret: string): CronAuth {
  if (!secret) return "no_secret";
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return header && timingSafeEqual(digest(header), digest(`Bearer ${secret}`)) ? "ok" : "denied";
}

export type CronTask = "refresh" | "weekly";

export type CronResult = {
  task: CronTask;
  insights: "refreshed" | "not_configured" | "token_invalid";
  realPosts: number;
  draftsAdded: number;
  reportId: string | null;
  skipped: string[];
  /** Always false. The cron never publishes. */
  published: false;
};

/** Refreshes real insights and, weekly, prepares Claude drafts for review plus the weekly report. Never publishes. */
export async function runSocialCron(task: CronTask, fetchImpl: FetchLike = fetch, now = new Date()): Promise<CronResult> {
  const result: CronResult = { task, insights: "not_configured", realPosts: 0, draftsAdded: 0, reportId: null, skipped: [], published: false };
  const snap = await refreshInsights(fetchImpl, now);
  if (!snap) {
    result.skipped.push("Meta is not configured (HELIX_META_ACCESS_TOKEN).");
    return result;
  }
  if (!snap.verification.ok) {
    result.insights = "token_invalid";
    result.skipped.push(snap.verification.error ?? "Meta rejected the token.");
    return result;
  }
  result.insights = "refreshed";
  const posts = realPosts(snap);
  result.realPosts = posts.length;
  if (task !== "weekly") return result;

  const brand = await getBrand();
  if (currentDeskMode() === "demo") {
    result.skipped.push("Desk is in demo mode, so no drafts from real results were added to the sample calendar.");
  } else {
    try {
      const { drafts } = await draftsFromTopPosts(posts, brand, { count: 5, fetchImpl, now, actor: "Helix AI (weekly cron)" });
      result.draftsAdded = (await addReviewDrafts(drafts)).length;
    } catch (err) {
      result.skipped.push(`Drafts: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  try {
    result.reportId = (await writeWeeklyReport(snap, brand, { fetchImpl, now })).id;
  } catch (err) {
    result.skipped.push(`Report: ${err instanceof Error ? err.message : "failed"}`);
  }
  return result;
}
