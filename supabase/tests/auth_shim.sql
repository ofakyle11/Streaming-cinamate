-- Minimal stand-in for the parts of a Supabase project the migrations depend
-- on, so they can be applied and checked against a plain PostgreSQL (CI, a
-- laptop). Never run this against a real Supabase project: there these roles,
-- the auth schema and auth.uid() already exist.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants every new table in public to these roles by default; only
-- RLS (and explicit revokes in the migrations) keep anon and other users out.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema if not exists auth;
-- On Supabase every API role may use the auth schema (auth.uid(), auth.jwt()).
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text,
  encrypted_password text,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb
);
alter table auth.users add column if not exists raw_app_meta_data jsonb;
alter table auth.users add column if not exists raw_user_meta_data jsonb;

-- Supabase's auth.uid() reads the JWT claims PostgREST sets per request; tests
-- set the same GUC with `set local request.jwt.claims`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

-- Supabase's auth.jwt() returns the whole claims object (email, role, sub...).
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- The deletion processor runs as service_role; it also needs to read and delete users.
grant select, delete on auth.users to service_role;
-- Here the migration runner owns auth.users; on Supabase supabase_auth_admin
-- owns it and postgres holds TRIGGER and UPDATE on it, which the strip-password
-- migration relies on. Trigger semantics do not depend on ownership.
