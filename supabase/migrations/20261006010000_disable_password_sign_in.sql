-- Email link is the only way to sign in to Lastframe.tv, so no account may
-- carry a password. GoTrue's /auth/v1/signup (email + password) is reachable
-- with the public anon key whatever the app shows; with a password an attacker
-- could pre-register a victim's address and keep a way in after the victim
-- later signs in with a link. This trigger strips the password from every
-- auth.users row as it is written, so password sign-in always fails with
-- "invalid credentials" and nothing else changes (magic links and OAuth never
-- set one). Idempotent.

create or replace function public.lf_strip_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.encrypted_password := null;
  return new;
end;
$$;

revoke all on function public.lf_strip_password() from public, anon, authenticated;

drop trigger if exists lf_strip_password on auth.users;
create trigger lf_strip_password
  before insert or update of encrypted_password on auth.users
  for each row execute function public.lf_strip_password();

-- Accounts created before this migration (none in production) lose theirs too.
update auth.users set encrypted_password = null where encrypted_password is not null;
