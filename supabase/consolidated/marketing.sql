-- ============================================================================
-- Helix for Marketing — CONSOLIDATED schema (marketing)
-- ============================================================================
-- Generated from: supabase/schemas/marketing.sql, cross-checked against
-- apps/marketing/src/lib/supabase-desk.ts (actual read/write column sets).
--
-- NOTE: apps/marketing has NO apps/marketing/supabase/ directory of its own
-- (confirmed — the app ships without app-owned migrations). Unlike the other
-- 3 apps, supabase/schemas/marketing.sql is genuinely the ONLY source for
-- this schema, and it round-trips cleanly against supabase-desk.ts: every
-- column supabaseSaveSpend/supabaseSaveLeads/supabaseSaveDecision writes
-- (toSpendRow/toLeadRow/toDecisionRow) and every column
-- fromSpendRow/fromLeadRow/fromDecisionRow reads is present here, and
-- nothing extra was found in code. Confidence: high — this is the
-- best-attested of the 4 apps because there was no drift to reconcile.
--
-- The app also runs standalone in-memory/localStorage mode without Supabase
-- (isSupabaseConfigured() gates all persistence) — this schema is only
-- needed once NEXT_PUBLIC_SUPABASE_URL + a service-role/anon key are set
-- for the marketing app in Vercel.
--
-- Idempotent: safe to run once on an empty Supabase project.
-- ============================================================================

create schema if not exists marketing;

-- ---------------------------------------------------------------------------
-- marketing.spend_events
-- ---------------------------------------------------------------------------
create table if not exists marketing.spend_events (
  id text primary key,
  campaign_id text not null,
  name text not null,
  platform text not null,
  spend double precision not null,
  impressions integer,
  clicks integer,
  form_leads integer,
  occurred_at date not null
);

create index if not exists spend_events_day_idx on marketing.spend_events (occurred_at desc);
create index if not exists spend_events_campaign_idx on marketing.spend_events (campaign_id);

-- ---------------------------------------------------------------------------
-- marketing.leads — campaign-attributed leads (separate from
-- lead_scoring.leads; do not confuse the two)
-- ---------------------------------------------------------------------------
create table if not exists marketing.leads (
  id text primary key,
  campaign_id text not null,
  name text not null,
  email text not null,
  classification text not null,
  score double precision not null,
  tier text not null,
  confidence double precision not null,
  created_at date not null
);

create index if not exists leads_campaign_idx on marketing.leads (campaign_id);
create index if not exists leads_created_idx on marketing.leads (created_at desc);

-- ---------------------------------------------------------------------------
-- marketing.decisions — HITL pause/scale/keep decisions per campaign
-- ---------------------------------------------------------------------------
create table if not exists marketing.decisions (
  campaign_id text primary key,
  action text not null,
  note text,
  at timestamptz not null default now(),
  actor text
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table marketing.spend_events enable row level security;
alter table marketing.leads enable row level security;
alter table marketing.decisions enable row level security;

-- Server uses the service role (bypasses RLS). No anon policies in the MVP.

-- ---------------------------------------------------------------------------
-- Grants + PostgREST exposure
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA marketing TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA marketing TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA marketing TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA marketing
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Combined PostgREST schema exposure for ALL Helix schemas (idempotent to
-- re-run; identical line appears in every consolidated/*.sql file).
-- ---------------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, lead_scoring, legal, inbox, commerce, marketing';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
