-- ============================================================================
-- Helix for Leads — CONSOLIDATED schema (lead_scoring)
-- ============================================================================
-- Generated from: apps/lead-scoring/supabase/{migration,phase1,phase2,phase3,
-- phase4-tenancy,phase5-branding}.sql, supabase/schemas/lead_scoring.sql, and
-- cross-checked against apps/lead-scoring/src/lib/supabase-leads.ts and
-- apps/lead-scoring/src/lib/org-auth.ts (the actual read/write column sets).
--
-- Idempotent: safe to run once on an empty Supabase project. Uses
-- `create schema/table if not exists`, `add column if not exists`, and
-- `drop ... if exists` before re-adding constraints/policies.
--
-- ASSUMPTION (medium confidence): the base `leads` table has NO versioned
-- CREATE TABLE in apps/lead-scoring/supabase/*.sql — phase1.sql only ALTERs
-- it. The only place a full CREATE TABLE for lead_scoring.leads exists in
-- git is supabase/schemas/lead_scoring.sql, which looks like a
-- point-in-time consolidated snapshot (same style/header as the other
-- supabase/schemas/*.sql files, which we already know can drift — inbox.sql
-- was missing columns). This file trusts supabase/schemas/lead_scoring.sql
-- for the base CREATE TABLE, then layers phase1-5 on top, then cross-checked
-- every column against supabase-leads.ts's toRow/fromRow (the code that
-- actually reads/writes this table) and org-auth.ts. No column used by the
-- code was found missing after that cross-check. Confidence: high that the
-- resulting table is complete for current code; the base file's provenance
-- (never independently reproduced from a live DB) is the residual risk.
-- ============================================================================

create schema if not exists lead_scoring;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- leads (base table — see provenance note above)
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.leads (
  id text primary key,
  created_at timestamptz not null default now(),
  run_id text not null,
  name text not null,
  email text not null,
  source text not null default 'unknown',
  message text not null default '',
  budget text,
  timeline text,
  classification text not null,
  score integer not null,
  tier text not null,
  confidence double precision not null,
  reasoning text not null,
  fields jsonb not null default '[]'::jsonb,
  needs_review boolean not null default false,
  crm_status text not null default 'not_sent',
  engine text not null default 'heuristic',

  -- migration.sql / phase3.sql: attribution, CRM ids, HITL actor
  phone text,
  company text,
  country text,
  region text,
  trade text,
  zip text,
  campaign_id text,
  utm_source text,
  utm_campaign text,
  ghl_contact_id text,
  pipeline_stage text not null default 'new',
  assignee text,
  notes jsonb not null default '[]'::jsonb,
  score_history jsonb not null default '[]'::jsonb,
  behaviors jsonb not null default '[]'::jsonb,
  reviewed_by text,
  reviewed_at timestamptz,

  -- migration.sql: enrichment / competitors (pre-phase1, additive only)
  enriched_industry text,
  enriched_size text,
  enriched_country text,
  battle_card text,
  competitors text[],

  -- phase1.sql: enriched_data jsonb (superset), conversion probability, scoring model fk
  enriched_data jsonb,
  conversion_probability integer not null default 0,
  scoring_model_id uuid,

  -- phase2.sql: closed-loop ROI + real GHL opportunity + Cal.com booking
  deal_value numeric,
  closed_at timestamptz,
  ghl_opportunity_id text,
  ghl_opportunity_error text,
  crm_error text,
  meeting_link text,
  meeting_confirmed_at timestamptz,

  -- phase4-tenancy.sql: org isolation (nullable until backfilled below, then not null)
  org_id uuid
);

alter table lead_scoring.leads
  drop constraint if exists leads_conversion_probability_check;
alter table lead_scoring.leads
  add constraint leads_conversion_probability_check
  check (conversion_probability >= 0 and conversion_probability <= 100);

create index if not exists leads_created_at_idx on lead_scoring.leads (created_at desc);
create index if not exists leads_tier_idx on lead_scoring.leads (tier);
create index if not exists leads_classification_idx on lead_scoring.leads (classification);

-- ---------------------------------------------------------------------------
-- sales_reps (uuid PK — phase1.sql superseded the old text-PK seed table)
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.sales_reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  territory text,
  industry_focus text,
  current_load integer not null default 0
);

create unique index if not exists sales_reps_email_idx on lead_scoring.sales_reps (email);

insert into lead_scoring.sales_reps (name, email, territory, industry_focus, current_load)
select * from (values
  ('Sam Patel', 'sam@helix.local', 'us', 'Enterprise', 0),
  ('Ana Ruiz', 'ana@helix.local', 'latam', 'SMB', 0),
  ('Luis Ortega', 'luis@helix.local', 'us', 'SMB', 0)
) as v(name, email, territory, industry_focus, current_load)
where not exists (
  select 1 from lead_scoring.sales_reps r where r.email = v.email
);

alter table lead_scoring.leads
  drop constraint if exists leads_assigned_rep_id_fkey;
alter table lead_scoring.leads add column if not exists assigned_rep_id uuid;
alter table lead_scoring.leads
  add constraint leads_assigned_rep_id_fkey
  foreign key (assigned_rep_id) references lead_scoring.sales_reps (id)
  on delete set null;

create index if not exists leads_assigned_rep_idx on lead_scoring.leads (assigned_rep_id);

-- ---------------------------------------------------------------------------
-- scoring_models
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.scoring_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weights jsonb not null default '{"budget": 40, "timeline": 30, "fit": 30}'::jsonb,
  custom_rules text[] not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

insert into lead_scoring.scoring_models (name, weights, custom_rules, is_active)
select
  'Default Helix',
  '{"budget": 40, "timeline": 30, "fit": 30}'::jsonb,
  '{}'::text[],
  true
where not exists (
  select 1 from lead_scoring.scoring_models where name = 'Default Helix'
);

alter table lead_scoring.leads
  drop constraint if exists leads_scoring_model_id_fkey;
alter table lead_scoring.leads
  add constraint leads_scoring_model_id_fkey
  foreign key (scoring_model_id) references lead_scoring.scoring_models (id)
  on delete set null;

create index if not exists leads_scoring_model_idx on lead_scoring.leads (scoring_model_id);

-- ---------------------------------------------------------------------------
-- lead_activities (timeline)
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references lead_scoring.leads (id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default 'system'
);

alter table lead_scoring.lead_activities drop constraint if exists lead_activities_type_check;
alter table lead_scoring.lead_activities
  add constraint lead_activities_type_check
  check (type in ('email_sent', 'call_logged', 'ai_action', 'status_change', 'note', 'meeting'));

alter table lead_scoring.lead_activities drop constraint if exists lead_activities_created_by_check;
alter table lead_scoring.lead_activities
  add constraint lead_activities_created_by_check
  check (created_by in ('user', 'system'));

create index if not exists lead_activities_lead_id_idx
  on lead_scoring.lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- organizations / org_members (phase4-tenancy.sql)
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  webhook_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_idx on lead_scoring.organizations (slug);
create unique index if not exists organizations_webhook_token_idx on lead_scoring.organizations (webhook_token);

-- phase5-branding.sql
alter table lead_scoring.organizations add column if not exists logo_url text;
alter table lead_scoring.organizations add column if not exists primary_color text;

create table if not exists lead_scoring.org_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references lead_scoring.organizations (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'operator', 'viewer')),
  created_at timestamptz not null default now()
);

create index if not exists org_members_org_idx on lead_scoring.org_members (org_id);

-- Backfill: default org for any pre-existing leads (no-op on an empty DB,
-- kept for idempotency / safety if this script is re-run after seed data).
insert into lead_scoring.organizations (name, slug)
select 'Default workspace', 'default'
where not exists (select 1 from lead_scoring.organizations where slug = 'default');

update lead_scoring.leads
set org_id = (select id from lead_scoring.organizations where slug = 'default')
where org_id is null;

alter table lead_scoring.leads drop constraint if exists leads_org_id_fkey;
alter table lead_scoring.leads
  add constraint leads_org_id_fkey foreign key (org_id) references lead_scoring.organizations (id)
  on delete cascade;

alter table lead_scoring.leads alter column org_id set not null;

create index if not exists leads_org_id_idx on lead_scoring.leads (org_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table lead_scoring.leads enable row level security;
alter table lead_scoring.sales_reps enable row level security;
alter table lead_scoring.scoring_models enable row level security;
alter table lead_scoring.lead_activities enable row level security;
alter table lead_scoring.organizations enable row level security;
alter table lead_scoring.org_members enable row level security;

drop policy if exists org_members_self on lead_scoring.org_members;
create policy org_members_self on lead_scoring.org_members
  for select using (user_id = auth.uid());

drop policy if exists organizations_member_read on lead_scoring.organizations;
create policy organizations_member_read on lead_scoring.organizations
  for select using (
    id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  );

drop policy if exists organizations_member_update on lead_scoring.organizations;
create policy organizations_member_update on lead_scoring.organizations
  for update using (
    id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  )
  with check (
    id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  );

drop policy if exists leads_org_isolation on lead_scoring.leads;
create policy leads_org_isolation on lead_scoring.leads
  for all using (
    org_id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  )
  with check (
    org_id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  );

-- Note: the app server uses the service-role key (bypasses RLS) for all
-- reads/writes and applies org_id filtering explicitly in application code
-- (see org-auth.ts). RLS above is a second layer for any future client that
-- authenticates as an end user with the anon key.

-- ---------------------------------------------------------------------------
-- Grants + PostgREST exposure
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA lead_scoring TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA lead_scoring TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lead_scoring TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA lead_scoring
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Combined PostgREST schema exposure for ALL Helix schemas.
-- Run this once, after all 5 consolidated app scripts have been applied
-- (this line is identical across all 4 consolidated/*.sql files — running it
-- multiple times is harmless, it just re-sets the same value).
-- ---------------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, lead_scoring, legal, inbox, commerce, marketing';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
