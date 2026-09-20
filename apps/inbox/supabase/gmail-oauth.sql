-- Real Gmail OAuth: refreshable per-workspace token + RFC Message-Id capture
-- for reply-in-thread. Additive; does not drop columns.

alter table inbox.email_accounts add column if not exists token_expires_at timestamptz;
alter table inbox.email_accounts add column if not exists gmail_history_id text;

-- The real RFC 822 Message-Id header (e.g. "<abc123@mail.gmail.com>"), needed
-- to build In-Reply-To/References headers for a reply that lands in the same
-- Gmail thread. Distinct from thread_messages.message_id, which historically
-- stored a synthetic internal id ("msg-<threadId>-0") — that column is left
-- as-is for backward compatibility; new ingests populate both.
alter table inbox.thread_messages add column if not exists gmail_message_id text;
alter table inbox.thread_messages add column if not exists rfc_message_id text;

notify pgrst, 'reload schema';
