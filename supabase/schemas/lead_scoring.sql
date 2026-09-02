-- Helix for Lead Scoring. Same Supabase project as Helix core.
-- Expose the schema to PostgREST (Dashboard → Settings → API → Exposed schemas)
-- or:
--   alter role authenticator set pgrst.db_schemas = 'public, lead_scoring';
--   notify pgrst, 'reload schema';

create schema if not exists lead_scoring;

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
  engine text not null default 'heuristic'
);

create index if not exists leads_created_at_idx on lead_scoring.leads (created_at desc);
create index if not exists leads_tier_idx on lead_scoring.leads (tier);
create index if not exists leads_classification_idx on lead_scoring.leads (classification);

alter table lead_scoring.leads enable row level security;

-- Server uses the service role (bypasses RLS). No anon policies in the MVP.
