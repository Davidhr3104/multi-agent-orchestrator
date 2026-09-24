-- Historical daily $ at-risk / $ saved snapshots — persisted once per day by
-- the daily-brief cron, so the dashboard can show a real trend over time
-- instead of only a live recompute of current state. Additive.

create table if not exists commerce.daily_risk_snapshots (
  date date primary key,
  orders_count integer not null default 0,
  high_risk_count integer not null default 0,
  high_risk_usd numeric not null default 0,
  saved_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

notify pgrst, 'reload schema';
