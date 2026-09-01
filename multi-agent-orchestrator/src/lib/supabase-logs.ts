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
