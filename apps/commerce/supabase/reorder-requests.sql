-- Inventory reorder write-back: internal draft PO records (draft → ordered →
-- received), the write-back action for low-stock products. Shopify's Admin
-- REST API has no native purchase-order endpoint, so this is Helix-owned
-- state, not a write to Shopify. Additive.

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

notify pgrst, 'reload schema';
