-- Helix for Inbox — full functional schema
-- Same Supabase project as Leads/Legal. Schema: inbox
-- MVP: user_id is nullable (no auth required for desk demo).
-- Expose schema `inbox` in Data API / authenticator pgrst.db_schemas.

create extension if not exists "pgcrypto";

create schema if not exists inbox;

create table if not exists inbox.workspaces (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  user_id text,
  created_at timestamptz not null default now()
);

create table if not exists inbox.email_accounts (
  id text primary key default gen_random_uuid()::text,
  workspace_id text references inbox.workspaces (id) on delete cascade,
  email_address text unique not null,
  provider text,
  access_token text,
  refresh_token text,
  is_connected boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists inbox.email_threads (
  id text primary key,
  workspace_id text references inbox.workspaces (id) on delete set null,
  email_account_id text references inbox.email_accounts (id) on delete set null,
  external_thread_id text unique,
  subject text,
  from_name text,
  from_email text,
  to_email text,
  body text,
  snippet text,
  category text not null default 'action_required',
  sentiment text not null default 'neutral',
  urgency_score integer not null default 0 check (urgency_score >= 0 and urgency_score <= 100),
  ai_confidence numeric(5, 2) not null default 0,
  classification_reasoning text not null default '',
  route_to text,
  route_target_id text,
  draft_reply text,
  draft_tone text default 'professional',
  status text not null default 'open',
  is_read boolean not null default false,
  is_starred boolean not null default false,
  needs_review boolean not null default false,
  snooze_until timestamptz,
  engine text not null default 'heuristic',
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inbox.thread_messages (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references inbox.email_threads (id) on delete cascade,
  message_id text,
  from_email text,
  to_email text,
  subject text,
  body text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists inbox.ai_actions_log (
  id text primary key default gen_random_uuid()::text,
  workspace_id text references inbox.workspaces (id) on delete set null,
  thread_id text references inbox.email_threads (id) on delete set null,
  action_type text not null,
  ai_decision text,
  confidence_score numeric(5, 2),
  human_override boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists inbox.user_preferences (
  id text primary key default gen_random_uuid()::text,
  user_id text,
  workspace_id text references inbox.workspaces (id) on delete cascade,
  auto_triage boolean not null default true,
  default_tone text not null default 'professional',
  vip_senders text[] default '{}',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  custom_rules jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_threads_workspace_idx on inbox.email_threads (workspace_id);
create index if not exists email_threads_status_idx on inbox.email_threads (status);
create index if not exists email_threads_category_idx on inbox.email_threads (category);
create index if not exists email_threads_urgency_idx on inbox.email_threads (urgency_score desc);
create index if not exists email_threads_snooze_idx on inbox.email_threads (snooze_until);
create index if not exists email_threads_received_idx on inbox.email_threads (received_at desc nulls last);
create index if not exists thread_messages_thread_idx on inbox.thread_messages (thread_id);
create index if not exists ai_log_thread_idx on inbox.ai_actions_log (thread_id);

alter table inbox.workspaces enable row level security;
alter table inbox.email_accounts enable row level security;
alter table inbox.email_threads enable row level security;
alter table inbox.thread_messages enable row level security;
alter table inbox.ai_actions_log enable row level security;
alter table inbox.user_preferences enable row level security;

grant usage on schema inbox to anon, authenticated, service_role;
grant all on all tables in schema inbox to anon, authenticated, service_role;
grant all on all sequences in schema inbox to anon, authenticated, service_role;
alter default privileges for role postgres in schema inbox
  grant all on tables to anon, authenticated, service_role;

-- Seed workspace + account (idempotent)
insert into inbox.workspaces (id, name, user_id)
values ('ws-northwind', 'Northwind EA', null)
on conflict (id) do nothing;

insert into inbox.email_accounts (id, workspace_id, email_address, provider, is_connected)
values ('acc-triage', 'ws-northwind', 'triage@company.io', 'gmail', true)
on conflict (email_address) do nothing;

insert into inbox.user_preferences (id, workspace_id, auto_triage, default_tone)
values ('pref-northwind', 'ws-northwind', true, 'professional')
on conflict (id) do nothing;

-- Reload PostgREST (include inbox alongside other Helix schemas)
alter role authenticator set pgrst.db_schemas = 'public, lead_scoring, legal, inbox';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
