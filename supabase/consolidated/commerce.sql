-- ============================================================================
-- Helix for Commerce — CONSOLIDATED schema (commerce)
-- ============================================================================
-- Generated from: supabase/schemas/commerce.sql (the only place the base
-- tables orders/products/inquiries/ai_actions_log/user_preferences are
-- versioned in git — see provenance note below), plus
-- apps/commerce/supabase/{daily-risk-snapshots,reorder-requests,
-- return-requests,shopify-native-fraud-signal}.sql, cross-checked against
-- apps/commerce/src/lib/supabase-commerce.ts (actual read/write column sets).
--
-- PROVENANCE / RISK (read before running in production):
-- apps/commerce/supabase/shopify-native-fraud-signal.sql says explicitly:
--   "no other apps/commerce/supabase/*.sql files exist in this repo — the
--   rest of the `commerce` schema (orders/products/inquiries/
--   user_preferences) was created outside the repo (dashboard or API) and
--   is only documented implicitly via the column mapping in
--   src/lib/supabase-commerce.ts."
-- That means the base CREATE TABLE for orders/products/inquiries was NEVER
-- versioned as an app-owned migration — only supabase/schemas/commerce.sql
-- (a separate, possibly-hand-maintained consolidated snapshot) has it, and
-- we already confirmed elsewhere in this repo that these schemas/*.sql
-- snapshots can drift from reality (inbox.sql was missing columns actually
-- in use). This file trusts supabase/schemas/commerce.sql for the base
-- tables, then cross-checked every column against supabase-commerce.ts's
-- toRow/fromRow functions (ai_actions_log has NO corresponding code in
-- supabase-commerce.ts at all — kept here only because it's in the
-- schemas/commerce.sql snapshot; the app may not actually write to it).
-- Confidence: high on orders/products/inquiries/user_preferences (every
-- column round-tripped through code was found); LOW/unverified on
-- ai_actions_log (no code reference found — may be unused, aspirational,
-- or written from a code path this review didn't reach).
--
-- Idempotent: safe to run once on an empty Supabase project.
-- ============================================================================

create schema if not exists commerce;

-- ---------------------------------------------------------------------------
-- commerce.orders
-- ---------------------------------------------------------------------------
create table if not exists commerce.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  shopify_order_id text unique,
  customer_name text not null,
  customer_email text not null,
  total_price numeric(10, 2) not null,
  currency text not null default 'USD',
  financial_status text not null,
  fulfillment_status text not null,
  items jsonb not null default '[]'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  customer_order_count integer not null default 0,

  fraud_score integer not null check (fraud_score >= 0 and fraud_score <= 100),
  fraud_reasoning text not null default '',
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  requires_review boolean not null default false,
  engine text not null default 'heuristic',
  demo_mode boolean not null default true,

  reviewed_by text,
  reviewed_at timestamptz,
  review_decision text check (review_decision in ('approved', 'flagged', 'cancelled')),

  -- shopify-native-fraud-signal.sql
  shopify_signal_applied boolean not null default false,
  shopify_risks jsonb not null default '[]'::jsonb
);

create index if not exists commerce_orders_created_at_idx on commerce.orders (created_at desc);
create index if not exists commerce_orders_risk_level_idx on commerce.orders (risk_level);
create index if not exists commerce_orders_requires_review_idx on commerce.orders (requires_review);

-- ---------------------------------------------------------------------------
-- commerce.products
-- ---------------------------------------------------------------------------
create table if not exists commerce.products (
  id text primary key,
  created_at timestamptz not null default now(),
  shopify_product_id text unique,
  title text not null,
  sku text not null,
  current_inventory integer not null default 0,
  reorder_point integer not null default 0,
  price numeric(10, 2) not null,
  image_url text,
  sales_velocity numeric(10, 2) not null default 0,

  predicted_stockout_days integer not null default 0,
  restock_recommended boolean not null default false,
  reasoning text not null default '',
  engine text not null default 'heuristic',
  demo_mode boolean not null default true
);

create index if not exists commerce_products_inventory_idx on commerce.products (current_inventory);
create index if not exists commerce_products_restock_idx on commerce.products (restock_recommended);

-- ---------------------------------------------------------------------------
-- commerce.inquiries
-- ---------------------------------------------------------------------------
create table if not exists commerce.inquiries (
  id text primary key,
  created_at timestamptz not null default now(),
  customer_email text not null,
  inquiry_text text not null,
  inquiry_type text not null check (
    inquiry_type in (
      'order_status', 'return_refund', 'product_question',
      'shipping_issue', 'complaint', 'other'
    )
  ),
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  ai_response text not null default '',
  requires_human boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  engine text not null default 'heuristic',
  demo_mode boolean not null default true
);

create index if not exists commerce_inquiries_requires_human_idx on commerce.inquiries (requires_human);
create index if not exists commerce_inquiries_status_idx on commerce.inquiries (status);

-- ---------------------------------------------------------------------------
-- commerce.ai_actions_log — UNVERIFIED against app code (see risk note above)
-- ---------------------------------------------------------------------------
create table if not exists commerce.ai_actions_log (
  id text primary key,
  created_at timestamptz not null default now(),
  action_type text not null,
  entity_type text not null check (entity_type in ('order', 'product', 'inquiry')),
  entity_id text not null,
  ai_decision text not null,
  confidence_score numeric(5, 2),
  human_override boolean not null default false
);

create index if not exists commerce_actions_entity_idx on commerce.ai_actions_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- commerce.user_preferences — single global row (id = 'default'), no
-- per-user auth in this MVP.
-- ---------------------------------------------------------------------------
create table if not exists commerce.user_preferences (
  id text primary key default 'default',
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- commerce.reorder_requests (reorder-requests.sql) — Helix-owned draft PO
-- state; Shopify has no native purchase-order endpoint.
-- ---------------------------------------------------------------------------
create table if not exists commerce.reorder_requests (
  id text primary key,
  product_id text not null,
  sku text not null,
  title text not null,
  quantity_suggested integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  ordered_at timestamptz,
  received_at timestamptz
);

create index if not exists reorder_requests_product_idx on commerce.reorder_requests (product_id);
create index if not exists reorder_requests_status_idx on commerce.reorder_requests (status);

-- ---------------------------------------------------------------------------
-- commerce.return_requests (return-requests.sql) — returns/RMA desk;
-- approving triggers a real Shopify refund for non-demo orders.
-- ---------------------------------------------------------------------------
create table if not exists commerce.return_requests (
  id text primary key,
  order_id text not null,
  shopify_order_id text not null,
  customer_email text not null,
  reason text not null,
  refund_amount numeric not null,
  restock boolean not null default false,
  status text not null default 'requested' check (status in ('requested', 'approved', 'refunded', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_by text,
  resolved_at timestamptz,
  shopify_refund_id text
);

create index if not exists return_requests_order_idx on commerce.return_requests (order_id);
create index if not exists return_requests_status_idx on commerce.return_requests (status);

-- ---------------------------------------------------------------------------
-- commerce.daily_risk_snapshots (daily-risk-snapshots.sql) — historical
-- daily $ at-risk / $ saved, persisted once/day by the daily-brief cron.
-- ---------------------------------------------------------------------------
create table if not exists commerce.daily_risk_snapshots (
  date date primary key,
  orders_count integer not null default 0,
  high_risk_count integer not null default 0,
  high_risk_usd numeric not null default 0,
  saved_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table commerce.orders enable row level security;
alter table commerce.products enable row level security;
alter table commerce.inquiries enable row level security;
alter table commerce.ai_actions_log enable row level security;
alter table commerce.user_preferences enable row level security;
alter table commerce.reorder_requests enable row level security;
alter table commerce.return_requests enable row level security;
alter table commerce.daily_risk_snapshots enable row level security;

-- Server uses the service role (bypasses RLS). No anon policies in the MVP.

-- ---------------------------------------------------------------------------
-- Grants + PostgREST exposure
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA commerce TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA commerce TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA commerce TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA commerce
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Combined PostgREST schema exposure for ALL Helix schemas (idempotent to
-- re-run; identical line appears in every consolidated/*.sql file).
-- ---------------------------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, lead_scoring, legal, inbox, commerce, marketing';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
