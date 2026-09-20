-- Helix for Leads — Real tenancy (org isolation via Supabase Auth + RLS).
-- Model: simple org — 1 org = 1 end customer. A user belongs to exactly one org.
-- Additive: existing rows get backfilled into a single default org so nothing breaks.
--
-- IMPORTANT: the app server currently talks to Supabase with the service-role key,
-- which bypasses RLS entirely. RLS below protects any client that authenticates as
-- an end user (e.g. a future browser-side Supabase client using the anon key).
-- The Next.js API routes must additionally filter by org_id explicitly — RLS is a
-- second layer, not a replacement for that application-level filter, as long as
-- the service-role key is used server-side.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  -- Identifies the org on inbound webhooks (e.g. GHL), which never carry a
  -- browser session/cookie. Not a secret an end user types — generated once
  -- at org creation and pasted into the GHL webhook URL.
  webhook_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_idx on lead_scoring.organizations (slug);
create unique index if not exists organizations_webhook_token_idx on lead_scoring.organizations (webhook_token);

-- ---------------------------------------------------------------------------
-- org_members — one row per (user, org). A user belongs to exactly one org
-- in the "simple org" model, enforced by the unique index on user_id.
-- ---------------------------------------------------------------------------
create table if not exists lead_scoring.org_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references lead_scoring.organizations (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'operator', 'viewer')),
  created_at timestamptz not null default now()
);

create index if not exists org_members_org_idx on lead_scoring.org_members (org_id);

-- ---------------------------------------------------------------------------
-- leads.org_id — backfill existing rows into one default org so nothing breaks.
-- ---------------------------------------------------------------------------
insert into lead_scoring.organizations (name, slug)
select 'Default workspace', 'default'
where not exists (select 1 from lead_scoring.organizations where slug = 'default');

alter table lead_scoring.leads add column if not exists org_id uuid;

update lead_scoring.leads
set org_id = (select id from lead_scoring.organizations where slug = 'default')
where org_id is null;

alter table lead_scoring.leads
  add constraint leads_org_id_fkey foreign key (org_id) references lead_scoring.organizations (id)
  on delete cascade;

alter table lead_scoring.leads alter column org_id set not null;

create index if not exists leads_org_id_idx on lead_scoring.leads (org_id);

-- ---------------------------------------------------------------------------
-- RLS: a user can only read/write leads in their own org.
-- ---------------------------------------------------------------------------
alter table lead_scoring.organizations enable row level security;
alter table lead_scoring.org_members enable row level security;
alter table lead_scoring.leads enable row level security;

drop policy if exists org_members_self on lead_scoring.org_members;
create policy org_members_self on lead_scoring.org_members
  for select using (user_id = auth.uid());

drop policy if exists organizations_member_read on lead_scoring.organizations;
create policy organizations_member_read on lead_scoring.organizations
  for select using (
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

notify pgrst, 'reload schema';
