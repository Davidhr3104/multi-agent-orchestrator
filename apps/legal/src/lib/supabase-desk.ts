import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StoredRfp } from "@helix/core";
import type { AuditEvent } from "@/lib/audit-types";

type Client = SupabaseClient;

let cached: Client | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabase(): Client | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

type DeskQuery = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean }
    ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    eq: (
      col: string,
      value: string
    ) => {
      maybeSingle: () => Promise<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
    };
  };
  upsert: (
    row: Record<string, unknown> | Record<string, unknown>[]
  ) => Promise<{ error: { message: string } | null }>;
};

function legalTable(db: Client, table: "rfps" | "audit_events"): DeskQuery {
  return (
    db as unknown as { schema: (name: string) => { from: (t: string) => DeskQuery } }
  )
    .schema("legal")
    .from(table);
}

function toRfpRow(rfp: StoredRfp) {
  return {
    id: rfp.id,
    created_at: rfp.createdAt,
    run_id: rfp.runId,
    title: rfp.title,
    issuer: rfp.issuer,
    body: rfp.body,
    client_profile: rfp.clientProfile,
    match_score: rfp.matchScore,
    tier: rfp.tier,
    method: rfp.method,
    amount: rfp.amount,
    deadline: rfp.deadline,
    confidence: rfp.confidence,
    reasoning: rfp.reasoning,
    fields: rfp.fields,
    unverified_count: rfp.unverifiedCount,
    needs_review: rfp.needsReview,
    corpus_status: rfp.corpusStatus,
    engine: rfp.engine,
  };
}

function fromRfpRow(row: Record<string, unknown>): StoredRfp {
  const tier = row.tier === "hot" || row.tier === "warm" || row.tier === "cold" ? row.tier : "cold";
  const method = row.method === "BEAR" || row.method === "SPI" || row.method === "other" ? row.method : "other";
  const corpusStatus = row.corpus_status === "mocked" ? "mocked" : "not_asked";
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    runId: String(row.run_id),
    title: String(row.title),
    issuer: String(row.issuer ?? "unspecified"),
    body: String(row.body ?? ""),
    clientProfile: String(row.client_profile ?? ""),
    matchScore: Number(row.match_score),
    tier,
    method,
    amount: String(row.amount ?? ""),
    deadline: String(row.deadline ?? ""),
    confidence: Number(row.confidence),
    reasoning: String(row.reasoning ?? ""),
    fields: (row.fields as StoredRfp["fields"]) ?? [],
    unverifiedCount: Number(row.unverified_count ?? 0),
    needsReview: Boolean(row.needs_review),
    corpusStatus,
    engine: row.engine === "claude" ? "claude" : "heuristic",
  };
}

function toAuditRow(event: AuditEvent) {
  return {
    id: event.id,
    at: event.at,
    actor: event.actor,
    action: event.action,
    detail: event.detail,
  };
}

function fromAuditRow(row: Record<string, unknown>): AuditEvent {
  return {
    id: String(row.id),
    at: String(row.at),
    actor: String(row.actor ?? "system"),
    action: String(row.action ?? ""),
    detail: String(row.detail ?? ""),
  };
}

export async function supabaseListRfps(): Promise<StoredRfp[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await legalTable(db, "rfps").select("*").order("created_at", {
    ascending: false,
  });
  if (error) {
    console.warn("[helix-legal] list rfps skipped:", error.message);
    return null;
  }
  return (data ?? []).map((row) => fromRfpRow(row as Record<string, unknown>));
}

export async function supabaseGetRfp(id: string): Promise<StoredRfp | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await legalTable(db, "rfps").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.warn("[helix-legal] get rfp skipped:", error.message);
    return null;
  }
  return data ? fromRfpRow(data as Record<string, unknown>) : null;
}

export async function supabaseUpsertRfp(rfp: StoredRfp): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await legalTable(db, "rfps").upsert(toRfpRow(rfp));
  if (error) {
    console.warn("[helix-legal] upsert rfp skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseUpsertRfps(rfps: StoredRfp[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || rfps.length === 0) return false;
  const { error } = await legalTable(db, "rfps").upsert(rfps.map(toRfpRow));
  if (error) {
    console.warn("[helix-legal] bootstrap rfps skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseListAudit(): Promise<AuditEvent[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await legalTable(db, "audit_events").select("*").order("at", {
    ascending: false,
  });
  if (error) {
    console.warn("[helix-legal] list audit skipped:", error.message);
    return null;
  }
  return (data ?? []).map((row) => fromAuditRow(row as Record<string, unknown>));
}

export async function supabaseUpsertAudit(event: AuditEvent): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await legalTable(db, "audit_events").upsert(toAuditRow(event));
  if (error) {
    console.warn("[helix-legal] upsert audit skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseUpsertAudits(events: AuditEvent[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || events.length === 0) return false;
  const { error } = await legalTable(db, "audit_events").upsert(events.map(toAuditRow));
  if (error) {
    console.warn("[helix-legal] bootstrap audit skipped:", error.message);
    return false;
  }
  return true;
}
