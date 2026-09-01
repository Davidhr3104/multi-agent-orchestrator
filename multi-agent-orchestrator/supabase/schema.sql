-- Run in Supabase SQL editor. Optional: the app works without it (logs stay in the SSE stream).

create table if not exists public.pipeline_logs (
  id text primary key,
  run_id text not null,
  ts timestamptz not null default now(),
  agent text not null,
  level text not null,
  message text not null,
  field text,
  confidence double precision,
  evidence text
);

create index if not exists pipeline_logs_run_id_idx on public.pipeline_logs (run_id, ts);
