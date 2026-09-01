import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PipelineLog } from "./types";

let cached: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export async function persistPipelineLog(
  runId: string,
  log: PipelineLog
): Promise<{ stored: "supabase" | "memory" }> {
  const db = getSupabase();
  if (!db) return { stored: "memory" };

  const { error } = await db.from("pipeline_logs").insert({
    id: log.id,
    run_id: runId,
    ts: log.ts,
    agent: log.agent,
    level: log.level,
    message: log.message,
    field: log.field ?? null,
    confidence: log.confidence ?? null,
    evidence: log.evidence ?? null,
  });

  if (error) {
    console.warn("[helix] supabase log insert skipped:", error.message);
    return { stored: "memory" };
  }
  return { stored: "supabase" };
}

export type RunSummary = {
  runId: string;
  lastTs: string;
  count: number;
};

export async function listRecentRuns(limit = 15): Promise<RunSummary[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from("pipeline_logs")
    .select("run_id, ts")
    .order("ts", { ascending: false })
    .limit(2000);

  if (error || !data) return [];

  const byRun = new Map<string, RunSummary>();
  for (const row of data as { run_id: string; ts: string }[]) {
    const existing = byRun.get(row.run_id);
    if (existing) {
      existing.count += 1;
    } else {
      byRun.set(row.run_id, { runId: row.run_id, lastTs: row.ts, count: 1 });
    }
  }

  return [...byRun.values()]
    .sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1))
    .slice(0, limit);
}

export async function listLogsForRun(runId: string): Promise<PipelineLog[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from("pipeline_logs")
    .select("id, ts, agent, level, message, field, confidence, evidence")
    .eq("run_id", runId)
    .order("ts", { ascending: true })
    .limit(500);

  if (error || !data) return [];
  return data as PipelineLog[];
}
