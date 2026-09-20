import { createClient } from "@supabase/supabase-js";
import { getSecret, onSecretsChanged, type StoredLead } from "@helix/core";

type Client = ReturnType<typeof createClient>;

let cached: Client | null | undefined;
onSecretsChanged(() => {
  cached = undefined;
});

export function isSupabaseConfigured(): boolean {
  return Boolean(
    getSecret("NEXT_PUBLIC_SUPABASE_URL") &&
      (getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  );
}

export function getSupabase(): Client | null {
  if (cached !== undefined) return cached;
  const url = getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
    phone: lead.phone ?? null,
    company: lead.company ?? null,
    country: lead.country ?? null,
    region: lead.region ?? null,
    trade: lead.trade ?? null,
    zip: lead.zip ?? null,
    campaign_id: lead.campaignId ?? null,
    utm_source: lead.utmSource ?? null,
    utm_campaign: lead.utmCampaign ?? null,
    classification: lead.classification,
    score: lead.score,
    tier: lead.tier,
    confidence: lead.confidence,
    reasoning: lead.reasoning,
    fields: lead.fields,
    needs_review: lead.needsReview,
    crm_status: lead.crmStatus,
    ghl_contact_id: lead.ghlContactId ?? null,
    pipeline_stage: lead.pipelineStage ?? "new",
    assignee: lead.assignee ?? null,
    notes: lead.notes ?? [],
    score_history: lead.scoreHistory ?? [],
    behaviors: lead.behaviors ?? [],
    engine: lead.engine,
    enriched_industry: lead.enrichedIndustry ?? null,
    enriched_size: lead.enrichedSize ?? null,
    enriched_country: lead.enrichedCountry ?? null,
    assigned_rep_id: lead.assignedRepId ?? null,
    competitors: (lead.competitors ?? []).map((c) => c.name),
    battle_card: lead.battleCard ?? null,
    reviewed_by: lead.reviewedBy ?? null,
    reviewed_at: lead.reviewedAt ?? null,
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
    phone: row.phone != null ? String(row.phone) : undefined,
    company: row.company != null ? String(row.company) : undefined,
    country: row.country != null ? String(row.country) : undefined,
    region: row.region != null ? String(row.region) : undefined,
    trade: row.trade != null ? String(row.trade) : undefined,
    zip: row.zip != null ? String(row.zip) : undefined,
    campaignId: row.campaign_id != null ? String(row.campaign_id) : undefined,
    utmSource: row.utm_source != null ? String(row.utm_source) : undefined,
    utmCampaign: row.utm_campaign != null ? String(row.utm_campaign) : undefined,
    classification: row.classification as StoredLead["classification"],
    score: Number(row.score),
    tier: row.tier as StoredLead["tier"],
    confidence: Number(row.confidence),
    reasoning: String(row.reasoning ?? ""),
    fields: (row.fields as StoredLead["fields"]) ?? [],
    needsReview: Boolean(row.needs_review),
    crmStatus: (row.crm_status as StoredLead["crmStatus"]) ?? "not_sent",
    ghlContactId: row.ghl_contact_id != null ? String(row.ghl_contact_id) : undefined,
    pipelineStage: (row.pipeline_stage as StoredLead["pipelineStage"]) ?? "new",
    assignee: row.assignee != null ? String(row.assignee) : undefined,
    notes: Array.isArray(row.notes) ? (row.notes as string[]) : undefined,
    scoreHistory: Array.isArray(row.score_history)
      ? (row.score_history as StoredLead["scoreHistory"])
      : undefined,
    behaviors: Array.isArray(row.behaviors) ? (row.behaviors as StoredLead["behaviors"]) : undefined,
    engine: row.engine === "claude" ? "claude" : "heuristic",
    enrichedIndustry: row.enriched_industry != null ? String(row.enriched_industry) : null,
    enrichedSize: row.enriched_size != null ? String(row.enriched_size) : null,
    enrichedCountry: row.enriched_country != null ? String(row.enriched_country) : null,
    assignedRepId: row.assigned_rep_id != null ? String(row.assigned_rep_id) : undefined,
    competitors: Array.isArray(row.competitors)
      ? (row.competitors as string[]).map((name) => ({ name, talkingPoints: [] }))
      : undefined,
    battleCard: row.battle_card != null ? String(row.battle_card) : undefined,
    reviewedBy: row.reviewed_by != null ? String(row.reviewed_by) : undefined,
    reviewedAt: row.reviewed_at != null ? String(row.reviewed_at) : undefined,
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

export async function supabaseDeleteLeads(ids: string[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || ids.length === 0) return false;
  const table = (
    db as unknown as {
      schema: (name: string) => {
        from: (table: string) => { delete: () => { in: (col: string, values: string[]) => Promise<{ error: { message: string } | null }> } };
      };
    }
  )
    .schema("lead_scoring")
    .from("leads");
  const { error } = await table.delete().in("id", ids);
  if (error) {
    console.warn("[helix-leads] delete skipped:", error.message);
    return false;
  }
  return true;
}
