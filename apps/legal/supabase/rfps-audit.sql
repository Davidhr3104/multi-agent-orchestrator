-- Helix for Legal — RFP desk + audit trail
-- Run in the Legal project's Supabase SQL editor after firm COI/pricing tables.
-- Expose schema `legal` under Dashboard → Settings → API → Exposed schemas.

create schema if not exists legal;

create table if not exists legal.rfps (
  id text primary key,
  created_at timestamptz not null default now(),
  run_id text not null,
  title text not null,
  issuer text not null default 'unspecified',
  body text not null,
  client_profile text not null default '',
  match_score integer not null,
  tier text not null,
  method text not null,
  amount text not null,
  deadline text not null,
  confidence double precision not null,
  reasoning text not null,
  fields jsonb not null default '[]'::jsonb,
  unverified_count integer not null default 0,
  needs_review boolean not null default false,
  corpus_status text not null default 'not_asked',
  engine text not null default 'heuristic'
);

create index if not exists rfps_created_at_idx on legal.rfps (created_at desc);
create index if not exists rfps_tier_idx on legal.rfps (tier);
create index if not exists rfps_needs_review_idx on legal.rfps (needs_review);

alter table legal.rfps enable row level security;

create table if not exists legal.audit_events (
  id text primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  detail text not null default ''
);

create index if not exists audit_events_at_idx on legal.audit_events (at desc);
create index if not exists audit_events_action_idx on legal.audit_events (action);

alter table legal.audit_events enable row level security;

-- Service role bypasses RLS. No anon policies in the MVP.
-- Grants + PostgREST exposure (if Dashboard → Data API → Exposed schemas is missing):
GRANT USAGE ON SCHEMA legal TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA legal TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA legal TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA legal
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Include lead_scoring only if that schema exists in this project.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, lead_scoring, legal';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
