import { createClient } from "@supabase/supabase-js";
import type { StoredLead } from "@helix/core";

type Client = ReturnType<typeof createClient>;

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

type LeadsQuery = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean }
    ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  };
  upsert: (
    row: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>;
};

function leadsTable(db: Client): LeadsQuery {
  return (db as unknown as { schema: (name: string) => { from: (table: string) => LeadsQuery } })
    .schema("lead_scoring")
    .from("leads");
}

function toRow(lead: StoredLead) {
  return {
    id: lead.id,
    created_at: lead.createdAt,
    run_id: lead.runId,
    name: lead.name,
    email: lead.email,
    source: lead.source,
    message: lead.message,
    budget: lead.budget ?? null,
    timeline: lead.timeline ?? null,
    classification: lead.classification,
    score: lead.score,
    tier: lead.tier,
    confidence: lead.confidence,
    reasoning: lead.reasoning,
    fields: lead.fields,
    needs_review: lead.needsReview,
    crm_status: lead.crmStatus,
    engine: lead.engine,
  };
}

function fromRow(row: Record<string, unknown>): StoredLead {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    runId: String(row.run_id),
    name: String(row.name),
    email: String(row.email),
    source: String(row.source ?? "unknown"),
    message: String(row.message ?? ""),
    budget: row.budget != null ? String(row.budget) : undefined,
    timeline: row.timeline != null ? String(row.timeline) : undefined,
    classification: row.classification as StoredLead["classification"],
    score: Number(row.score),
    tier: row.tier as StoredLead["tier"],
    confidence: Number(row.confidence),
    reasoning: String(row.reasoning ?? ""),
    fields: (row.fields as StoredLead["fields"]) ?? [],
    needsReview: Boolean(row.needs_review),
    crmStatus: (row.crm_status as StoredLead["crmStatus"]) ?? "not_sent",
    engine: row.engine === "claude" ? "claude" : "heuristic",
  };
}

export async function supabaseListLeads(): Promise<StoredLead[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await leadsTable(db).select("*").order("created_at", {
    ascending: false,
  });
  if (error) {
    console.warn("[helix-leads] list skipped:", error.message);
    return null;
  }
  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>));
}

export async function supabaseUpsertLead(lead: StoredLead): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await leadsTable(db).upsert(toRow(lead));
  if (error) {
    console.warn("[helix-leads] upsert skipped:", error.message);
    return false;
  }
  return true;
}
