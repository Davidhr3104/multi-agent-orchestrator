-- Helix for Social: one JSON snapshot per org. Apply in the social schema.
create schema if not exists social;

create table if not exists social.desk_state (
  org_id text primary key,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table social.desk_state enable row level security;
