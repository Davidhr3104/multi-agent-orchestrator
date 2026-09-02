-- Helix for Legal. Same Supabase project as Helix core.
-- Expose schema `legal` in API settings when you persist RFPs.

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

alter table legal.rfps enable row level security;
