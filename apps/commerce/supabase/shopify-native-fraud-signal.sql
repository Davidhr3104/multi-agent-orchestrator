-- Native Shopify fraud signal (e.g. Shopify Protect) blended into the
-- unified Helix fraud score. Additive; does not drop columns.
--
-- NOTE: no other apps/commerce/supabase/*.sql files exist in this repo — the
-- rest of the `commerce` schema (orders/products/inquiries/user_preferences)
-- was created outside the repo (dashboard or API) and is only documented
-- implicitly via the column mapping in src/lib/supabase-commerce.ts. This
-- file assumes that schema already exists.

alter table commerce.orders add column if not exists shopify_signal_applied boolean not null default false;
alter table commerce.orders add column if not exists shopify_risks jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
