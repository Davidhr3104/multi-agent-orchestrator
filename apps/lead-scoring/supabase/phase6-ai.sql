-- Claude triage, next-best-move drafts, cron CRM proposals and HubSpot sync state per lead.
-- Additive; does not drop columns. Until this runs, leads still save (without these fields).

alter table lead_scoring.leads add column if not exists ai_triage jsonb;
alter table lead_scoring.leads add column if not exists next_move jsonb;
alter table lead_scoring.leads add column if not exists crm_proposal jsonb;
alter table lead_scoring.leads add column if not exists hubspot_contact_id text;
alter table lead_scoring.leads add column if not exists hubspot_synced_at timestamptz;
alter table lead_scoring.leads add column if not exists hubspot_error text;

notify pgrst, 'reload schema';
