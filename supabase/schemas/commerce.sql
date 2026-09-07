-- Helix for Commerce. Same Supabase project as Helix core.
-- Expose the schema to PostgREST (Dashboard → Settings → API → Exposed schemas)
-- or:
--   alter role authenticator set pgrst.db_schemas = 'public, commerce';
--   notify pgrst, 'reload schema';

create schema if not exists commerce;

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
  review_decision text check (review_decision in ('approved', 'flagged', 'cancelled'))
);

create index if not exists commerce_orders_created_at_idx on commerce.orders (created_at desc);
create index if not exists commerce_orders_risk_level_idx on commerce.orders (risk_level);
create index if not exists commerce_orders_requires_review_idx on commerce.orders (requires_review);

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

-- No per-user auth exists yet in this MVP, so preferences are a single global row
-- (id = 'default') rather than keyed by a real user id. Revisit once auth lands.
create table if not exists commerce.user_preferences (
  id text primary key default 'default',
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table commerce.orders enable row level security;
alter table commerce.products enable row level security;
alter table commerce.inquiries enable row level security;
alter table commerce.ai_actions_log enable row level security;
alter table commerce.user_preferences enable row level security;

-- Server uses the service role (bypasses RLS). No anon policies in the MVP.
