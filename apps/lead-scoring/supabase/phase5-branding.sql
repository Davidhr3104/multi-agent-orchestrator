-- Real, org-backed white-label branding — logo + primary color per org.
-- Additive; does not drop columns.

alter table lead_scoring.organizations add column if not exists logo_url text;
alter table lead_scoring.organizations add column if not exists primary_color text;

drop policy if exists organizations_member_update on lead_scoring.organizations;
create policy organizations_member_update on lead_scoring.organizations
  for update using (
    id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  )
  with check (
    id in (select org_id from lead_scoring.org_members where user_id = auth.uid())
  );

notify pgrst, 'reload schema';
