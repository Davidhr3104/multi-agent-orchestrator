-- Helix for Leads: enrichment, routing, competitors.
-- Run in the lead_scoring schema. Does not drop or rename existing columns.

create table if not exists lead_scoring.sales_reps (
  id text primary key,
  name text not null,
  email text not null,
  territory text,
  industry_focus text,
  current_load integer not null default 0
);

insert into lead_scoring.sales_reps (id, name, email, territory, industry_focus, current_load)
values
  ('rep-enterprise', 'Sam Patel', 'sam@helix.local', 'us', 'Enterprise', 0),
  ('rep-ana', 'Ana Ruiz', 'ana@helix.local', 'latam', 'SMB', 0),
  ('rep-luis', 'Luis Ortega', 'luis@helix.local', 'us', 'SMB', 0)
on conflict (id) do nothing;

alter table lead_scoring.leads add column if not exists enriched_industry text;
alter table lead_scoring.leads add column if not exists enriched_size text;
alter table lead_scoring.leads add column if not exists enriched_country text;
alter table lead_scoring.leads add column if not exists assigned_rep_id text;
alter table lead_scoring.leads add column if not exists competitors text[];
alter table lead_scoring.leads add column if not exists battle_card text;
