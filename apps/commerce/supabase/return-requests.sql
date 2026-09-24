-- Lightweight returns/RMA desk. Approving a return triggers a real Shopify
-- refund (POST /orders/{id}/refunds.json) for non-demo orders — this is a
-- genuine write-back, unlike reorder_requests which has no Shopify
-- equivalent to write to. Additive.

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

notify pgrst, 'reload schema';
