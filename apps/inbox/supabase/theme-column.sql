-- Helix for Inbox — theme column (idempotent)
alter table inbox.user_preferences
  add column if not exists theme text not null default 'dark';

-- Soft constraint for existing rows
update inbox.user_preferences
set theme = 'dark'
where theme is null or theme not in ('dark', 'light');
