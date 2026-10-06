-- Devices: where an account is signed in.
--
-- Supabase does not expose a user's sessions to the client, so the app keeps
-- its own list. The browser registers itself after sign-in under a random
-- per-browser id (localStorage `lf.device`, see src/services/auth/devices.ts)
-- and refreshes `last_seen_at` while it is used. "Forget this device" on the
-- account page sets `revoked_at`; the browser sees that on its next check
-- (sign-in, tab focus, every few minutes) and signs itself out locally.
-- "Sign out everywhere" is Supabase's global sign-out and needs no row here.
--
-- Every row belongs to one auth user; RLS confines each signed-in user to their
-- own rows and anonymous clients to nothing. Deleting the auth user cascades.
-- Idempotent: safe to run repeatedly.

create table if not exists public.devices (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id           text        not null check (char_length(id) between 8 and 64),
  -- Human label, e.g. "Chrome on macOS", derived from the user agent on the client.
  label        text        not null default '' check (char_length(label) <= 80),
  user_agent   text        not null default '' check (char_length(user_agent) <= 400),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz,
  primary key (user_id, id)
);

create index if not exists devices_user_seen_idx on public.devices (user_id, last_seen_at desc);

-- The owner can never be changed, and clocks from the client are not trusted:
-- `created_at` is fixed by the server, `last_seen_at` is set here on every write.
create or replace function public.lf_devices_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot change';
    end if;
    new.created_at := old.created_at;
    -- A revoked device stays revoked: its own heartbeat cannot clear the flag.
    if old.revoked_at is not null then
      new.revoked_at := old.revoked_at;
    end if;
  else
    new.created_at := now();
    new.revoked_at := null;
  end if;
  new.last_seen_at := now();
  return new;
end;
$$;

drop trigger if exists devices_before_write on public.devices;
create trigger devices_before_write
  before insert or update on public.devices
  for each row execute function public.lf_devices_before_write();

-- --------------------------------------------------------------- privileges

revoke all on public.devices from anon;
grant select, insert, update, delete on public.devices to authenticated;
-- Same for the deletion queue, which relied on RLS alone to keep anon out.
revoke all on public.account_deletion_requests from anon;

-- --------------------------------------------------------------- row level security

alter table public.devices enable row level security;

drop policy if exists "devices_select_own" on public.devices;
create policy "devices_select_own" on public.devices
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "devices_insert_own" on public.devices;
create policy "devices_insert_own" on public.devices
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "devices_update_own" on public.devices;
create policy "devices_update_own" on public.devices
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "devices_delete_own" on public.devices;
create policy "devices_delete_own" on public.devices
  for delete to authenticated using (user_id = auth.uid());
