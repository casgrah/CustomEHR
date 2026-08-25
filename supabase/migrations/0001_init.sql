-- ============================================================================
-- 0001_init.sql — the spine.
--
-- Two things here are load-bearing and hard to retrofit, so they are day one:
--   1. Every row carries tenant_id, and RLS enforces isolation in the DATABASE.
--      Application code is never the thing standing between two agencies' data.
--   2. Value list items and users are RETIRED, never deleted. Anything already
--      pointing at them keeps resolving.
--
-- Locked decisions this encodes: L-01 multi-tenant from day one, F-12 facility
-- scoping, and the "stable IDs, never display strings" rule — every reference is
-- a uuid or a stable code, never a label someone can rename.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tenants ---
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table facilities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on facilities (tenant_id);

-- ------------------------------------------------------------------ users ---
create type app_role as enum
  ('owner','admin','supervisor','clinician','peer','case_manager','qa','billing','readonly');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  full_name   text not null default '',
  credential  text not null default '',
  role        app_role not null default 'clinician',
  is_active   boolean not null default true,   -- deactivate, never delete
  created_at  timestamptz not null default now()
);
create index on profiles (tenant_id);

-- An invitation is how a second person joins a tenant. No service-role key ever
-- reaches the browser: the invite is a row, and the signup trigger below reads it.
create table invitations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  credential  text not null default '',
  role        app_role not null default 'clinician',
  invited_by  uuid references profiles(id),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (tenant_id, email)
);
create index on invitations (email) where accepted_at is null;

-- ------------------------------------------------------------ value lists ---
-- Define once, reference everywhere. Renaming a label never breaks a reference,
-- because references bind to the code, not the text.
create table value_lists (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  key         text not null,                    -- 'loc', 'flags', 'dc_reason', …
  name        text not null,
  owner       text not null default 'tenant',   -- 'tenant' | 'system'
  scope       text not null default 'Agency',
  used_by     text[] not null default '{}',
  unique (tenant_id, key)
);

create table value_list_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  list_id     uuid not null references value_lists(id) on delete cascade,
  code        text not null,
  label       text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,    -- retire, never delete
  created_at  timestamptz not null default now(),
  unique (list_id, code)
);
create index on value_list_items (tenant_id, list_id);

-- ---------------------------------------------------------------- clients ---
create table clients (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  mrn           text not null,
  first_name    text not null,
  last_name     text not null,
  preferred_name text not null default '',
  dob           date,
  medicaid_id   text not null default '',
  payer         text not null default '',
  phone         text not null default '',
  email         text not null default '',
  notes         text not null default '',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid references profiles(id),
  unique (tenant_id, mrn)
);
create index on clients (tenant_id);

-- --------------------------------------------------------------- episodes ---
-- Half-open interval [admit_date, discharge_date). Two episodes overlap when
-- A.admit < B.discharge AND B.admit < A.discharge. Never <=.
create table episodes (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  facility_id       uuid references facilities(id),
  level_of_care     text not null,              -- value_list_items.code, list 'loc'
  admit_date        date not null,
  discharge_date    date,                       -- null = open
  discharge_reason  text,
  primary_counselor uuid references profiles(id),
  closed            boolean not null default false,  -- discharged but still workable
  created_at        timestamptz not null default now(),
  check (discharge_date is null or discharge_date > admit_date)
);
create index on episodes (tenant_id, client_id);

-- -------------------------------------------------------------- audit log ---
-- Written by triggers, never by the client. Append only.
create table audit_log (
  id          bigserial primary key,
  tenant_id   uuid not null,
  actor       uuid,
  action      text not null,        -- insert | update | delete
  entity      text not null,
  entity_id   uuid,
  detail      jsonb,
  at          timestamptz not null default now()
);
create index on audit_log (tenant_id, at desc);

-- ============================================================================
-- Helpers. SECURITY DEFINER so they can read profiles without tripping RLS on
-- profiles itself (which would recurse).
-- ============================================================================
create or replace function current_tenant_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid()
$$;

create or replace function current_app_role() returns app_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin') from profiles where id = auth.uid()), false)
$$;

-- ============================================================================
-- Signup. First person in creates the tenant and becomes owner. Anyone with a
-- matching open invitation joins that tenant instead, with the role they were
-- invited as.
-- ============================================================================
create or replace function seed_tenant(t uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare l uuid;
begin
  insert into facilities (tenant_id, name) values (t, 'Main');

  insert into value_lists (tenant_id, key, name, owner, scope, used_by)
    values (t,'loc','Levels of care','system','State / payer',
            array['Census','Episodes','Schedule','Billing rules'])
    returning id into l;
  insert into value_list_items (tenant_id, list_id, code, label, sort_order) values
    (t,l,'2.5','PHP 2.5',1),(t,l,'2.1','IOP 2.1',2),(t,l,'3.5','RES 3.5',3),
    (t,l,'3.1','RES 3.1',4),(t,l,'1.0','OP 1.0',5);

  insert into value_lists (tenant_id, key, name, owner, scope, used_by)
    values (t,'dc_reason','Discharge reasons','tenant','Per program',
            array['Episode discharge','Recently discharged','Outcomes report'])
    returning id into l;
  insert into value_list_items (tenant_id, list_id, code, label, sort_order) values
    (t,l,'X-01','Completed treatment',1),(t,l,'X-02','Stepped down to IOP',2),
    (t,l,'X-03','Left against advice',3),(t,l,'X-04','Administrative discharge',4),
    (t,l,'X-05','Transferred — higher level',5);

  insert into value_lists (tenant_id, key, name, owner, scope, used_by)
    values (t,'flags','Client flags','tenant','Agency',
            array['Census face card','Chart header','Group note roster'])
    returning id into l;
  insert into value_list_items (tenant_id, list_id, code, label, sort_order) values
    (t,l,'F-01','Allergies',1),(t,l,'F-02','Safety plan',2),(t,l,'F-03','Elopement risk',3),
    (t,l,'F-05','MOUD',4),(t,l,'F-06','Interpreter required',5),(t,l,'F-07','Court-involved',6);

  insert into value_lists (tenant_id, key, name, owner, scope, used_by)
    values (t,'payers','Payers & plans','tenant','State',
            array['Demographics','Authorizations','Claims'])
    returning id into l;
  insert into value_list_items (tenant_id, list_id, code, label, sort_order) values
    (t,l,'PY-1','Anthem HealthKeepers',1),(t,l,'PY-2','Aetna Better Health',2),
    (t,l,'PY-3','Humana Healthy Horizons',3),(t,l,'PY-4','Sentara Community Plan',4),
    (t,l,'PY-5','UnitedHealthcare',5),(t,l,'PY-6','Cardinal Care FFS',6);
end $$;

create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype; t uuid;
begin
  select * into inv from invitations
    where email = lower(new.email) and accepted_at is null
    order by created_at limit 1;

  if found then
    insert into profiles (id, tenant_id, full_name, credential, role)
      values (new.id, inv.tenant_id,
              coalesce(nullif(inv.full_name,''), new.raw_user_meta_data->>'full_name', new.email),
              inv.credential, inv.role);
    update invitations set accepted_at = now() where id = inv.id;
  else
    insert into tenants (name)
      values (coalesce(nullif(new.raw_user_meta_data->>'org_name',''), 'New organization'))
      returning id into t;
    insert into profiles (id, tenant_id, full_name, role)
      values (new.id, t, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'owner');
    perform seed_tenant(t);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ============================================================================
-- Audit trigger
-- ============================================================================
create or replace function audit_row() returns trigger
  language plpgsql security definer set search_path = public as $$
declare t uuid; eid uuid;
begin
  t := coalesce(
        case when tg_op = 'DELETE' then (to_jsonb(old)->>'tenant_id')::uuid
             else (to_jsonb(new)->>'tenant_id')::uuid end,
        current_tenant_id());
  eid := case when tg_op = 'DELETE' then (to_jsonb(old)->>'id')::uuid
              else (to_jsonb(new)->>'id')::uuid end;
  insert into audit_log (tenant_id, actor, action, entity, entity_id, detail)
    values (t, auth.uid(), lower(tg_op), tg_table_name, eid,
            case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return null;
end $$;

create trigger audit_clients  after insert or update or delete on clients
  for each row execute function audit_row();
create trigger audit_episodes after insert or update or delete on episodes
  for each row execute function audit_row();
create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function audit_row();

-- ============================================================================
-- Row level security. This is the tenant boundary — not application code.
-- ============================================================================
alter table tenants          enable row level security;
alter table facilities       enable row level security;
alter table profiles         enable row level security;
alter table invitations      enable row level security;
alter table value_lists      enable row level security;
alter table value_list_items enable row level security;
alter table clients          enable row level security;
alter table episodes         enable row level security;
alter table audit_log        enable row level security;

create policy tenant_read on tenants for select
  using (id = current_tenant_id());
create policy tenant_update on tenants for update
  using (id = current_tenant_id() and is_admin());

create policy fac_all on facilities for all
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy prof_read on profiles for select
  using (tenant_id = current_tenant_id());
create policy prof_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy prof_admin on profiles for update
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id());

create policy inv_read on invitations for select
  using (tenant_id = current_tenant_id());
create policy inv_write on invitations for all
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy vl_read on value_lists for select
  using (tenant_id = current_tenant_id());
create policy vl_write on value_lists for all
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy vli_read on value_list_items for select
  using (tenant_id = current_tenant_id());
create policy vli_write on value_list_items for all
  using (tenant_id = current_tenant_id() and is_admin())
  with check (tenant_id = current_tenant_id() and is_admin());

create policy cl_read on clients for select
  using (tenant_id = current_tenant_id());
create policy cl_write on clients for all
  using (tenant_id = current_tenant_id() and current_app_role() <> 'readonly')
  with check (tenant_id = current_tenant_id() and current_app_role() <> 'readonly');

create policy ep_read on episodes for select
  using (tenant_id = current_tenant_id());
create policy ep_write on episodes for all
  using (tenant_id = current_tenant_id() and current_app_role() <> 'readonly')
  with check (tenant_id = current_tenant_id() and current_app_role() <> 'readonly');

-- Audit is readable by admins, writable by nobody through the API.
create policy audit_read on audit_log for select
  using (tenant_id = current_tenant_id() and is_admin());
