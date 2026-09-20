-- Closed-loop ROI: real deal value + close timestamp on won leads. Additive; does not drop columns.

alter table lead_scoring.leads add column if not exists deal_value numeric;
alter table lead_scoring.leads add column if not exists closed_at timestamptz;

-- Real pipeline routing to GHL: opportunity id/error alongside the existing contact id.
alter table lead_scoring.leads add column if not exists ghl_opportunity_id text;
alter table lead_scoring.leads add column if not exists ghl_opportunity_error text;

-- Real booking via Cal.com: confirmed meeting link/timestamp (meeting_link was never persisted before).
alter table lead_scoring.leads add column if not exists meeting_link text;
alter table lead_scoring.leads add column if not exists meeting_confirmed_at timestamptz;
