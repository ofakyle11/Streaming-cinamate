-- Admin allow-list.
--
-- Lastframe.tv has no passwords, so an "admin account" is an ordinary
-- email-link account whose address is on this list. Nothing in the app is
-- gated on it yet; it exists so that future admin features (RLS policies,
-- RPCs, an admin page) have one answer to "is this person an admin":
-- public.lf_is_admin(), which checks the email claim of the current JWT.
--
-- Rows are added by the owner only (SQL editor or service role): there is no
-- insert, update or delete policy, so no client can promote anyone. A signed-in
-- user can read their own row (and nothing else) to learn whether they are an
-- admin. Adding an admin (docs/SUPABASE.md):
--   insert into public.admin_users (email, note) values ('person@example.com', 'Mark');
-- Idempotent: safe to run repeatedly.

create table if not exists public.admin_users (
  email    text        primary key check (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1),
  note     text        not null default '' check (char_length(note) <= 80),
  added_at timestamptz not null default now()
);

-- Email of the current request's JWT, lower-cased; null when anonymous.
create or replace function public.lf_jwt_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''))
$$;

-- True when the signed-in user's email is on the allow-list.
create or replace function public.lf_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
     where a.email = public.lf_jwt_email()
  )
$$;

-- --------------------------------------------------------------- privileges

revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;

revoke all on function public.lf_jwt_email() from public, anon;
grant execute on function public.lf_jwt_email() to authenticated, service_role;
revoke all on function public.lf_is_admin() from public, anon;
grant execute on function public.lf_is_admin() to authenticated, service_role;

-- --------------------------------------------------------------- row level security

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self" on public.admin_users
  for select to authenticated using (email = public.lf_jwt_email());
-- No insert/update/delete policies: only the owner (SQL editor, service role) edits the list.
