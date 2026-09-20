-- Lead-intent detection + handoff to Helix for Leads. Additive; does not drop columns.

alter table inbox.email_threads add column if not exists lead_intent boolean not null default false;
alter table inbox.email_threads add column if not exists handed_off_at timestamptz;

create index if not exists email_threads_lead_intent_idx on inbox.email_threads (lead_intent) where lead_intent;

notify pgrst, 'reload schema';
