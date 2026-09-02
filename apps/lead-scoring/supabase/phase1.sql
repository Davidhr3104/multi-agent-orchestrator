-- Helix for Leads — FASE 1
-- Schema: lead_scoring (same project as the app; expose it in PostgREST).
-- Additive only: does not drop leads, rename columns, or change leads.id (text PK).
--
-- Note: lead_scoring.leads.id is TEXT (ingest ids like lead-xxxxxxxx).
-- lead_activities.lead_id is TEXT to match. assigned_rep_id / scoring_model_id are UUID.

create schema if not exists lead_scoring;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- sales_reps (uuid PK)
-- If an earlier seed table used text ids, replace it (seed-only, no live FKs).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'lead_scoring'
      and table_name = 'sales_reps'
      and column_name = 'id'
      and data_type = 'text'
  ) then
    alter table lead_scoring.leads drop constraint if exists leads_assigned_rep_id_fkey;
    alter table lead_scoring.leads drop column if exists assigned_rep_id;
    drop table lead_scoring.sales_reps;
  end if;
end $$;

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

-- ---------------------------------------------------------------------------
-- leads: new columns (keep existing enriched_industry / size / country)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'lead_scoring'
      and table_name = 'leads'
      and column_name = 'assigned_rep_id'
      and data_type = 'text'
  ) then
    alter table lead_scoring.leads drop column assigned_rep_id;
  end if;
end $$;

alter table lead_scoring.leads add column if not exists enriched_data jsonb;
alter table lead_scoring.leads add column if not exists assigned_rep_id uuid;
alter table lead_scoring.leads add column if not exists competitors text[];
alter table lead_scoring.leads add column if not exists battle_card text;
alter table lead_scoring.leads add column if not exists conversion_probability integer not null default 0;
alter table lead_scoring.leads add column if not exists scoring_model_id uuid;

alter table lead_scoring.leads drop constraint if exists leads_conversion_probability_check;
alter table lead_scoring.leads
  add constraint leads_conversion_probability_check
  check (conversion_probability >= 0 and conversion_probability <= 100);

alter table lead_scoring.leads drop constraint if exists leads_assigned_rep_id_fkey;
alter table lead_scoring.leads
  add constraint leads_assigned_rep_id_fkey
  foreign key (assigned_rep_id) references lead_scoring.sales_reps (id)
  on delete set null;

alter table lead_scoring.leads drop constraint if exists leads_scoring_model_id_fkey;
alter table lead_scoring.leads
  add constraint leads_scoring_model_id_fkey
  foreign key (scoring_model_id) references lead_scoring.scoring_models (id)
  on delete set null;

create index if not exists leads_assigned_rep_idx on lead_scoring.leads (assigned_rep_id);
create index if not exists leads_scoring_model_idx on lead_scoring.leads (scoring_model_id);

-- ---------------------------------------------------------------------------
-- lead_activities (timeline)
-- lead_id is TEXT to match lead_scoring.leads.id
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

alter table lead_scoring.sales_reps enable row level security;
alter table lead_scoring.scoring_models enable row level security;
alter table lead_scoring.lead_activities enable row level security;

notify pgrst, 'reload schema';
