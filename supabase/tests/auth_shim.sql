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

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- Supabase's auth.uid() reads the JWT claims PostgREST sets per request; tests
-- set the same GUC with `set local request.jwt.claims`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

-- The deletion processor runs as service_role; nothing else is needed from auth.
grant usage on schema auth to service_role;
grant select, delete on auth.users to service_role;
