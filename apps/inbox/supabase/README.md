# Helix for Inbox — Supabase migrations

## Fresh database

Run `full-schema.sql` once. It now includes every column added by the incremental
migrations below (`handed_off_at`, `last_reply_sent_at`), so a brand-new database
provisioned from this file alone is already up to date — you do not need to also run
the incremental files after it.

## Already-provisioned database (upgrading in place)

Apply the incremental migration files in this order, after `full-schema.sql` has
already been run once historically:

1. `threads.sql`
2. `gmail-oauth.sql`
3. `theme-column.sql`
4. `lead-handoff.sql` — adds `lead_intent`, `handed_off_at`
5. `last-reply-sent-at.sql` — adds `last_reply_sent_at`

All of these are additive (`add column if not exists`) and idempotent — safe to
re-run.

## Deploy ordering — read before shipping this branch

**`last-reply-sent-at.sql` must be applied to the production Supabase instance
BEFORE this code deploys.** The app code writes `last_reply_sent_at` on every
thread upsert (`supabaseUpsertThread` in `src/lib/supabase-desk.ts`) as soon as this
branch ships. If the column doesn't exist yet, that upsert fails; Supabase writes
are treated as best-effort everywhere in this app (`supabaseUpsertThread`,
`supabaseUpsertThreads`, etc. all log a warning and return `false` on error rather
than throwing), so the failure will NOT crash the request — it will silently fall
back to in-memory-only persistence for every thread write. Deploying the code first
and the migration second reproduces this every single request until the migration
is applied, with no visible error to an operator watching the UI (only a
`console.warn("[helix-inbox] upsert thread skipped: ...")` in server logs).

Same deploy-before-code rule applies to any future `ALTER TABLE` migration added
here — this file exists specifically so that requirement doesn't get lost the way
it did for this column before this note was added.
