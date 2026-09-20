-- Attribution, CRM ids, HITL actor. Additive; does not drop columns.

alter table lead_scoring.leads add column if not exists phone text;
alter table lead_scoring.leads add column if not exists company text;
alter table lead_scoring.leads add column if not exists country text;
alter table lead_scoring.leads add column if not exists region text;
alter table lead_scoring.leads add column if not exists trade text;
alter table lead_scoring.leads add column if not exists zip text;
alter table lead_scoring.leads add column if not exists campaign_id text;
alter table lead_scoring.leads add column if not exists utm_source text;
alter table lead_scoring.leads add column if not exists utm_campaign text;
alter table lead_scoring.leads add column if not exists ghl_contact_id text;
alter table lead_scoring.leads add column if not exists pipeline_stage text;
alter table lead_scoring.leads add column if not exists assignee text;
alter table lead_scoring.leads add column if not exists notes jsonb;
alter table lead_scoring.leads add column if not exists score_history jsonb;
alter table lead_scoring.leads add column if not exists behaviors jsonb;
alter table lead_scoring.leads add column if not exists reviewed_by text;
alter table lead_scoring.leads add column if not exists reviewed_at timestamptz;
