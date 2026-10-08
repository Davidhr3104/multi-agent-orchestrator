-- Helix for Data — C1 datasets, versions, profiles, issues, diffs, decisions.
-- Same Supabase project as other desks. Expose schema `data` in the Data API.

create schema if not exists data;

create table if not exists data.datasets (
  id text primary key,
  org_id text not null default 'org-helix',
  name text not null,
  source text not null default 'file',
  original_file_name text not null,
  invented boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists data.dataset_versions (
  id text primary key,
  dataset_id text not null references data.datasets (id) on delete cascade,
  kind text not null,
  storage_key text not null,
  rows integer not null,
  cols integer not null default 0,
  hash text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists data.column_profiles (
  id text primary key,
  version_id text not null references data.dataset_versions (id) on delete cascade,
  column_name text not null,
  column_index integer not null,
  inferred_type text not null,
  completeness numeric(6, 4) not null default 0,
  mixed_formats boolean not null default false,
  empty boolean not null default false,
  unique_count integer not null default 0,
  sample jsonb not null default '[]'::jsonb,
  issue_count integer not null default 0
);

create table if not exists data.issues (
  id text primary key,
  version_id text not null references data.dataset_versions (id) on delete cascade,
  column_name text not null,
  row_index integer not null,
  rule_id text not null,
  severity text not null,
  message text not null
);

create table if not exists data.proposed_changes (
  id text primary key,
  issue_id text,
  version_id text not null references data.dataset_versions (id) on delete cascade,
  cell_ref text not null,
  row_index integer not null,
  column_name text not null,
  before_value text not null,
  after_value text not null,
  rule_id text not null,
  origin text not null,
  confidence numeric(5, 2) not null,
  evidence text not null,
  auto_approve boolean not null default false
);

create table if not exists data.decisions (
  change_id text primary key references data.proposed_changes (id) on delete cascade,
  decided_by text not null,
  decided_at timestamptz,
  status text not null
);

create table if not exists data.publications (
  id text primary key,
  version_id text not null references data.dataset_versions (id) on delete cascade,
  target_app text not null,
  contract_version integer not null,
  accepted integer not null default 0,
  rejected integer not null default 0,
  dry_run boolean not null default true,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists datasets_created_idx on data.datasets (created_at desc);
create index if not exists dataset_versions_dataset_idx on data.dataset_versions (dataset_id, created_at desc);
create index if not exists column_profiles_version_idx on data.column_profiles (version_id);
create index if not exists issues_version_idx on data.issues (version_id);
create index if not exists proposed_changes_version_idx on data.proposed_changes (version_id);
create index if not exists decisions_status_idx on data.decisions (status);

alter table data.datasets enable row level security;
alter table data.dataset_versions enable row level security;
alter table data.column_profiles enable row level security;
alter table data.issues enable row level security;
alter table data.proposed_changes enable row level security;
alter table data.decisions enable row level security;
alter table data.publications enable row level security;

grant usage on schema data to anon, authenticated, service_role;
grant all on all tables in schema data to anon, authenticated, service_role;
grant all on all sequences in schema data to anon, authenticated, service_role;
alter default privileges for role postgres in schema data
  grant all on tables to anon, authenticated, service_role;

alter role authenticator set pgrst.db_schemas = 'public, lead_scoring, legal, inbox, data';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
