-- ============================================================================
-- Helix for Legal — CONSOLIDATED schema (legal + a few unscoped/public tables)
-- ============================================================================
-- Generated from: apps/legal/supabase/{migration,no-bid-rules,rfps-audit}.sql,
-- supabase/schemas/legal.sql, and cross-checked against
-- apps/legal/src/lib/supabase-desk.ts (actual read/write column sets).
--
-- NOTE on schema placement: apps/legal/supabase/migration.sql
-- (firm_clients, firm_matters, historical_pricing, pricing_rules) and
-- no-bid-rules.sql (no_bid_rules) create their tables WITHOUT a schema
-- prefix, i.e. in `public` as authored. This file preserves that as-authored
-- behavior (does not silently move them into `legal`) since app code was not
-- found reading/writing these 5 tables directly (see risk note at bottom) —
-- changing their schema here would be an unrequested design decision.
-- Confidence: high that this matches what running the original files verbatim
-- would produce; medium on whether `public` was ever the intended final
-- location (the RFP desk itself correctly uses the `legal` schema).
--
-- Idempotent: safe to run once on an empty Supabase project.
-- ============================================================================

create schema if not exists legal;

-- ---------------------------------------------------------------------------
-- legal.rfps — the RFP desk (schema-qualified in source; matches supabase-desk.ts)
-- ---------------------------------------------------------------------------
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
  engine text not null default 'heuristic',
  -- rfps-audit.sql additive columns
  partner_decision jsonb,
  corpus_hits jsonb default '[]'::jsonb
);

create index if not exists rfps_created_at_idx on legal.rfps (created_at desc);
create index if not exists rfps_tier_idx on legal.rfps (tier);
create index if not exists rfps_needs_review_idx on legal.rfps (needs_review);

alter table legal.rfps enable row level security;

-- ---------------------------------------------------------------------------
-- legal.desk_meta / legal.conflicts / legal.quotes — small KV tables
-- ---------------------------------------------------------------------------
create table if not exists legal.desk_meta (
  id text primary key,
  body text not null default ''
);

create table if not exists legal.conflicts (
  rfp_id text primary key,
  report jsonb not null
);

create table if not exists legal.quotes (
  rfp_id text primary key,
  quote jsonb not null
);

-- ---------------------------------------------------------------------------
-- legal.audit_events — RFP desk audit trail
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- public.firm_clients / public.firm_matters — Conflict of Interest (COI) data
-- from apps/legal/supabase/migration.sql. Seeded with demo rows; the app
-- also seeds the same rows in memory when these tables are unreachable, so
-- this is a real fallback, not a hard dependency.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL UNIQUE,
  client_type TEXT DEFAULT 'Corporate',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.firm_matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.firm_clients(id),
  matter_name TEXT NOT NULL,
  opposing_party TEXT,
  matter_type TEXT,
  status TEXT DEFAULT 'Closed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.firm_clients (client_name, client_type, status) VALUES
  ('Northstar PI Consortium', 'Corporate', 'Active'),
  ('Harbor Occupational Health', 'Corporate', 'Inactive'),
  ('TechVentures LLC', 'Corporate', 'Active')
ON CONFLICT (client_name) DO NOTHING;

INSERT INTO public.firm_matters (client_id, matter_name, opposing_party, matter_type, status)
SELECT c.id, v.matter_name, v.opposing_party, v.matter_type, v.status
FROM public.firm_clients c
JOIN (
  VALUES
    ('Northstar PI Consortium', 'Mass Tort Defense 2024', 'Plaintiff Group A', 'Litigation', 'Active'),
    ('Harbor Occupational Health', 'Workers Comp Audit', 'State Labor Board', 'RFP Response', 'Closed')
) AS v(client_name, matter_name, opposing_party, matter_type, status)
  ON c.client_name = v.client_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.firm_matters m WHERE m.matter_name = v.matter_name
);

-- ---------------------------------------------------------------------------
-- public.historical_pricing / public.pricing_rules — smart pricing data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historical_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_title TEXT,
  practice_area TEXT,
  jurisdiction TEXT,
  complexity_score INT,
  estimated_hours INT,
  actual_hours INT,
  proposed_amount DECIMAL(12,2),
  won_amount DECIMAL(12,2),
  win_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_area TEXT,
  min_rate DECIMAL(10,2),
  max_rate DECIMAL(10,2),
  avg_rate DECIMAL(10,2),
  jurisdiction TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.historical_pricing (rfp_title, practice_area, jurisdiction, complexity_score, estimated_hours, proposed_amount, won_amount, win_rate)
SELECT v.rfp_title, v.practice_area, v.jurisdiction, v.complexity_score, v.estimated_hours, v.proposed_amount, v.won_amount, v.win_rate
FROM (
  VALUES
    ('Mass Tort Defense 2024', 'Litigation', 'US', 8, 200, 400000.00, 380000.00, 75.00),
    ('Workers Comp Audit', 'Employment', 'US', 5, 80, 160000.00, 150000.00, 80.00),
    ('Medical Record Review', 'Healthcare', 'US', 6, 120, 240000.00, 220000.00, 70.00)
) AS v(rfp_title, practice_area, jurisdiction, complexity_score, estimated_hours, proposed_amount, won_amount, win_rate)
WHERE NOT EXISTS (
  SELECT 1 FROM public.historical_pricing h WHERE h.rfp_title = v.rfp_title
);

INSERT INTO public.pricing_rules (practice_area, min_rate, max_rate, avg_rate, jurisdiction)
SELECT v.practice_area, v.min_rate, v.max_rate, v.avg_rate, v.jurisdiction
FROM (
  VALUES
    ('Litigation', 1500.00, 2500.00, 2000.00, 'US'),
    ('Employment', 1200.00, 2000.00, 1600.00, 'US'),
    ('Healthcare', 1400.00, 2200.00, 1800.00, 'US')
) AS v(practice_area, min_rate, max_rate, avg_rate, jurisdiction)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules r WHERE r.practice_area = v.practice_area AND r.jurisdiction = v.jurisdiction
);

-- ---------------------------------------------------------------------------
-- public.no_bid_rules — structured no-bid policy (no-bid-rules.sql)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.no_bid_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.no_bid_rules (pattern, reason) VALUES
  ('kubernetes', 'Pure Kubernetes / SaaS catalog work is outside the firm''s practice areas.'),
  ('shopify', 'Shopify-adjacent vendor portal work is outside the firm''s practice areas.')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grants + PostgREST exposure
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA legal TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA legal TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA legal TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA legal
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Combined PostgREST schema exposure for ALL Helix schemas (idempotent to
-- re-run; identical line appears in every consolidated/*.sql file).
-- ---------------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, lead_scoring, legal, inbox, commerce, marketing';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
