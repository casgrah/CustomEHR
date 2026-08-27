-- ============================================================================
-- 0003_forms.sql — the form builder.
--
-- forms-and-authorizations.md already names the pattern (§ "One pattern
-- underneath"): a form is a definition plus saved defaults plus composed
-- output, and that's worth one general model rather than rebuilding it for
-- every clinical form. This is that model, built generic first and applied to
-- a real form (ARTS, ROI) as a later slice.
--
-- A template's entire shape lives in `schema` (jsonb) — an ordered array of
-- blocks (header, text, section, field, checkbox, image, divider). Adding a
-- new form, or changing an existing one, is a row write, never a migration.
-- No physical table gets created per form; that's what keeps this safe for a
-- tenant admin to do themselves, and what keeps every form queryable/reportable
-- the same way once responses (a later slice) exist.
-- ============================================================================

create table form_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  schema      jsonb not null default '[]'::jsonb,
  version     int not null default 1,
  is_active   boolean not null default true,   -- retire, never delete
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on form_templates (tenant_id);

create or replace function touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger form_templates_touch before update on form_templates
  for each row execute function touch_updated_at();

alter table form_templates enable row level security;

create policy ft_read on form_templates for select
  using (tenant_id = current_tenant_id());
create policy ft_write on form_templates for all
  using (tenant_id = current_tenant_id() and current_app_role() <> 'readonly')
  with check (tenant_id = current_tenant_id() and current_app_role() <> 'readonly');

create trigger audit_form_templates after insert or update or delete on form_templates
  for each row execute function audit_row();

-- ---------------------------------------------------------- form images ---
-- One bucket, tenant-scoped by the first path segment (`<tenant_id>/...`),
-- enforced the same way every table above is. Public read: this environment
-- is invented data only, no BAA (see build-phase-1.md); revisit before a real
-- client photo or scanned document ever lands here.
insert into storage.buckets (id, name, public)
  values ('form-assets', 'form-assets', true)
  on conflict (id) do nothing;

create policy form_assets_read on storage.objects for select
  using (bucket_id = 'form-assets');
create policy form_assets_write on storage.objects for insert
  with check (bucket_id = 'form-assets'
    and (storage.foldername(name))[1] = current_tenant_id()::text);
create policy form_assets_delete on storage.objects for delete
  using (bucket_id = 'form-assets'
    and (storage.foldername(name))[1] = current_tenant_id()::text);
