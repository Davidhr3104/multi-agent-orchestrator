-- Helix for Inbox — threads + conversation history
-- Same Supabase project as Leads/Legal. Expose schema `inbox` in Data API
-- (or run GRANT + ALTER ROLE authenticator below).

create schema if not exists inbox;

create table if not exists inbox.email_threads (
  id text primary key,
  subject text,
  from_name text,
  from_email text,
  body text,
  category text not null default 'action_required',
  -- action_required | fyi | meeting | spam
  sentiment text not null default 'neutral',
  -- positive | neutral | negative | urgent
  urgency_score integer not null default 0 check (urgency_score >= 0 and urgency_score <= 100),
  ai_confidence numeric(5, 2) not null default 0,
  route_to text,
  draft_reply text,
  status text not null default 'open',
  -- open | review | routed | blocked | archived
  snooze_until timestamptz,
  reasoning text not null default '',
  engine text not null default 'heuristic',
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inbox.thread_messages (
  id text primary key,
  thread_id text not null references inbox.email_threads (id) on delete cascade,
  from_email text,
  body text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_threads_status_idx on inbox.email_threads (status);
create index if not exists email_threads_category_idx on inbox.email_threads (category);
create index if not exists email_threads_snooze_idx on inbox.email_threads (snooze_until);
create index if not exists email_threads_created_idx on inbox.email_threads (created_at desc);
create index if not exists thread_messages_thread_idx on inbox.thread_messages (thread_id, sent_at);

alter table inbox.email_threads enable row level security;
alter table inbox.thread_messages enable row level security;

grant usage on schema inbox to anon, authenticated, service_role;
grant all on all tables in schema inbox to anon, authenticated, service_role;
grant all on all sequences in schema inbox to anon, authenticated, service_role;
alter default privileges for role postgres in schema inbox
  grant all on tables to anon, authenticated, service_role;

-- Append inbox to exposed schemas (adjust list if your project differs)
alter role authenticator set pgrst.db_schemas = 'public, lead_scoring, legal, inbox';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
