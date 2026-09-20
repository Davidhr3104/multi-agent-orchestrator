-- Helix for Marketing. Same Supabase project as Helix core.
-- Expose schema `marketing` in API settings to persist spend, leads, and HITL.

create schema if not exists marketing;

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

create table if not exists marketing.decisions (
  campaign_id text primary key,
  action text not null,
  note text,
  at timestamptz not null default now(),
  actor text
);

alter table marketing.spend_events enable row level security;
alter table marketing.leads enable row level security;
alter table marketing.decisions enable row level security;
