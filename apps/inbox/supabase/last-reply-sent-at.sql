-- Track when the last outbound reply was sent on a thread. Additive; does not drop columns.

alter table inbox.email_threads add column if not exists last_reply_sent_at timestamptz;

notify pgrst, 'reload schema';
