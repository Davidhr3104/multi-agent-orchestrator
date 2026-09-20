import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSecret, onSecretsChanged, type AttributedLead, type HitlDecision, type SpendEvent } from "@helix/core";

type Client = SupabaseClient;

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
  const key = getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
  };
  upsert: (
    row: Record<string, unknown> | Record<string, unknown>[]
  ) => Promise<{ error: { message: string } | null }>;
};

function table(db: Client, name: "spend_events" | "leads" | "decisions"): DeskQuery {
  return (
    db as unknown as { schema: (n: string) => { from: (t: string) => DeskQuery } }
  )
    .schema("marketing")
    .from(name);
}

function toSpendRow(e: SpendEvent) {
  return {
    id: e.id,
    campaign_id: e.campaignId,
    name: e.name,
    platform: e.platform,
    spend: e.spend,
    impressions: e.impressions ?? null,
    clicks: e.clicks ?? null,
    form_leads: e.formLeads ?? null,
    occurred_at: e.occurredAt.slice(0, 10),
  };
}

function fromSpendRow(row: Record<string, unknown>): SpendEvent {
  const platform = row.platform === "google" || row.platform === "other" ? row.platform : "meta";
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    name: String(row.name),
    platform,
    spend: Number(row.spend),
    impressions: row.impressions == null ? undefined : Number(row.impressions),
    clicks: row.clicks == null ? undefined : Number(row.clicks),
    formLeads: row.form_leads == null ? undefined : Number(row.form_leads),
    occurredAt: String(row.occurred_at).slice(0, 10),
  };
}

function toLeadRow(l: AttributedLead) {
  return {
    id: l.id,
    campaign_id: l.campaignId,
    name: l.name,
    email: l.email,
    classification: l.classification,
    score: l.score,
    tier: l.tier,
    confidence: l.confidence,
    created_at: l.createdAt.slice(0, 10),
  };
}

function fromLeadRow(row: Record<string, unknown>): AttributedLead {
  const classification =
    row.classification === "spam" || row.classification === "info" || row.classification === "lead"
      ? row.classification
      : "info";
  const tier = row.tier === "hot" || row.tier === "warm" || row.tier === "cold" ? row.tier : "cold";
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    name: String(row.name),
    email: String(row.email),
    classification,
    score: Number(row.score),
    tier,
    confidence: Number(row.confidence),
    createdAt: String(row.created_at).slice(0, 10),
  };
}

function toDecisionRow(d: HitlDecision) {
  return {
    campaign_id: d.campaignId,
    action: d.action,
    note: d.note ?? null,
    at: d.at,
    actor: d.actor ?? null,
  };
}

function fromDecisionRow(row: Record<string, unknown>): HitlDecision {
  const action = row.action === "pause" || row.action === "scale" || row.action === "keep" ? row.action : "keep";
  return {
    campaignId: String(row.campaign_id),
    action,
    note: row.note ? String(row.note) : undefined,
    at: String(row.at),
    actor: row.actor ? String(row.actor) : undefined,
  };
}

export async function supabaseLoadDesk(): Promise<{
  spend: SpendEvent[];
  leads: AttributedLead[];
  decisions: HitlDecision[];
} | null> {
  const db = getSupabase();
  if (!db) return null;
  const [spendRes, leadRes, decRes] = await Promise.all([
    table(db, "spend_events").select("*").order("occurred_at", { ascending: true }),
    table(db, "leads").select("*").order("created_at", { ascending: true }),
    table(db, "decisions").select("*").order("at", { ascending: false }),
  ]);
  if (spendRes.error || leadRes.error || decRes.error) {
    console.warn(
      "[helix-marketing] supabase load skipped:",
      spendRes.error?.message || leadRes.error?.message || decRes.error?.message
    );
    return null;
  }
  return {
    spend: (spendRes.data ?? []).map((row) => fromSpendRow(row as Record<string, unknown>)),
    leads: (leadRes.data ?? []).map((row) => fromLeadRow(row as Record<string, unknown>)),
    decisions: (decRes.data ?? []).map((row) => fromDecisionRow(row as Record<string, unknown>)),
  };
}

export async function supabaseSaveSpend(events: SpendEvent[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || events.length === 0) return false;
  const { error } = await table(db, "spend_events").upsert(events.map(toSpendRow));
  if (error) {
    console.warn("[helix-marketing] upsert spend skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseSaveLeads(leads: AttributedLead[]): Promise<boolean> {
  const db = getSupabase();
  if (!db || leads.length === 0) return false;
  const { error } = await table(db, "leads").upsert(leads.map(toLeadRow));
  if (error) {
    console.warn("[helix-marketing] upsert leads skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseSaveDecision(decision: HitlDecision): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await table(db, "decisions").upsert(toDecisionRow(decision));
  if (error) {
    console.warn("[helix-marketing] upsert decision skipped:", error.message);
    return false;
  }
  return true;
}

export async function supabaseBootstrap(input: {
  spend: SpendEvent[];
  leads: AttributedLead[];
  decisions: HitlDecision[];
}): Promise<boolean> {
  const spendOk = await supabaseSaveSpend(input.spend);
  const leadsOk = await supabaseSaveLeads(input.leads);
  if (input.decisions.length === 0) return spendOk || leadsOk;
  const db = getSupabase();
  if (!db) return spendOk || leadsOk;
  const { error } = await table(db, "decisions").upsert(input.decisions.map(toDecisionRow));
  if (error) console.warn("[helix-marketing] bootstrap decisions skipped:", error.message);
  return spendOk || leadsOk;
}
