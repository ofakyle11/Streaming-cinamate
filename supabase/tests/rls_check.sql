-- Row Level Security check for every per-user table.
--
-- Signs in as two users (A and B) through the JWT claims PostgREST uses, writes
-- rows as A, then proves that B cannot read, change or delete them, that anon
-- sees nothing, that nobody can forge a row for someone else, that a revoked
-- device stays revoked through the client's own upsert, that passwords are
-- stripped from auth.users, and that deleting the auth user cascades. Each
-- block raises on failure, so `psql -v ON_ERROR_STOP=1 -f` exits non-zero.
--
-- Runs after the migrations (and supabase/tests/auth_shim.sql on plain
-- PostgreSQL). Everything happens in one transaction that is rolled back.

begin;

insert into auth.users (id, email, encrypted_password) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@lastframe.test', '$2a$10$attacker-chosen-password-hash'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@lastframe.test', null)
on conflict (id) do nothing;

-- ------------------------------------------------------------ passwords never persist
do $$
begin
  if exists (select 1 from auth.users where encrypted_password is not null) then
    raise exception 'a password survived insert into auth.users';
  end if;
  update auth.users set encrypted_password = '$2a$10$x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if exists (select 1 from auth.users where encrypted_password is not null) then
    raise exception 'a password survived update of auth.users';
  end if;
end;
$$;

-- ------------------------------------------------------------ as user A: write
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

insert into public.profiles (id, name, avatar, kid, created_at, updated_at)
  values ('p1', 'Ada', 'astro', false, now(), now());
insert into public.watchlist (profile_id, title_id, added_at, updated_at)
  values ('p1', 603, now(), now()), ('p1', 604, now(), now());
insert into public.history (profile_id, title_id, position, duration, last_watched_at, completed, updated_at)
  values ('p1', 603, 10, 100, now(), false, now());
insert into public.ratings (profile_id, title_id, rating, rated_at, updated_at)
  values ('p1', 603, 5, now(), now());
insert into public.devices (id, label, user_agent) values
  ('device-aaaaaaaa', 'Chrome on macOS', 'UA'),
  ('device-aaaaaaa2', 'Safari on iPhone', 'UA2');
insert into public.account_deletion_requests default values;

do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'A should see 1 profile'; end if;
  if (select count(*) from public.devices) <> 2 then raise exception 'A should see 2 devices'; end if;
  if (select count(distinct user_id) from public.devices) <> 1
     or exists (select 1 from public.devices where user_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'devices.user_id must default to auth.uid()';
  end if;
end;
$$;

-- A cannot forge a row for B (default user_id is overridden with B's id).
do $$
begin
  begin
    insert into public.profiles (user_id, id, name, created_at, updated_at)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'forged', 'Forged', now(), now());
    raise exception 'A inserted a profile for B';
  exception when insufficient_privilege then null; -- expected: RLS with check
  end;
  begin
    insert into public.devices (user_id, id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'forged-device');
    raise exception 'A inserted a device for B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.account_deletion_requests (user_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'A queued a deletion for B';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- A cannot hand a row over to B.
do $$
begin
  begin
    update public.profiles set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'p1';
    raise exception 'A moved a profile to B';
  exception when insufficient_privilege or raise_exception then null; -- RLS or the trigger
  end;
end;
$$;

-- Revoking a device ("forget this device" from device 2) and the forgotten
-- device's own heartbeat, which is the client's real upsert path.
update public.devices set revoked_at = now() where id = 'device-aaaaaaaa';
do $$
declare d record;
begin
  insert into public.devices (id, label, user_agent) values ('device-aaaaaaaa', 'Chrome on macOS', 'UA-new')
    on conflict (user_id, id) do update set label = excluded.label, user_agent = excluded.user_agent;
  select * into d from public.devices where id = 'device-aaaaaaaa';
  if d.revoked_at is null then raise exception 'the client upsert cleared revoked_at'; end if;
  if d.user_agent <> 'UA-new' then raise exception 'upsert did not update the row'; end if;
  update public.devices set revoked_at = null, last_seen_at = '2000-01-01', created_at = '2000-01-01'
    where id = 'device-aaaaaaaa';
  select * into d from public.devices where id = 'device-aaaaaaaa';
  if d.revoked_at is null then raise exception 'a revoked device cleared its own revoked_at'; end if;
  if d.created_at < now() - interval '1 minute' then raise exception 'client changed created_at'; end if;
  if d.last_seen_at < now() - interval '1 minute' then raise exception 'client set last_seen_at'; end if;
  -- A user cannot mark their own deletion request processed.
  update public.account_deletion_requests set processed_at = now();
  if exists (select 1 from public.account_deletion_requests where processed_at is not null) then
    raise exception 'A marked a deletion request processed';
  end if;
end;
$$;

-- ------------------------------------------------------------ as user B: read nothing
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

do $$
declare t text; n bigint;
begin
  foreach t in array array['profiles', 'watchlist', 'history', 'ratings', 'devices', 'account_deletion_requests'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'B can read % rows of A in %', n, t; end if;
  end loop;
  -- Updates and deletes by B silently match no rows.
  update public.profiles set name = 'Hijacked' where id = 'p1';
  update public.devices set revoked_at = now() where id = 'device-aaaaaaa2';
  update public.devices set revoked_at = null where id = 'device-aaaaaaaa';
  delete from public.watchlist where title_id = 603;
  delete from public.devices where id = 'device-aaaaaaaa';
end;
$$;

-- ------------------------------------------------------------ as anon: nothing at all
set local role anon;
reset request.jwt.claims;
do $$
declare t text; n bigint;
begin
  foreach t in array array['profiles', 'watchlist', 'history', 'ratings', 'devices', 'account_deletion_requests'] loop
    begin
      -- Either no grant at all (revoked) or RLS with no anon policy: zero rows.
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'anon can read rows from %', t; end if;
    exception when insufficient_privilege then null; -- expected: no grant
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------ back as A: rows intact, own deletes work
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
do $$
begin
  if (select name from public.profiles where id = 'p1') <> 'Ada' then raise exception 'B changed A''s profile'; end if;
  if (select count(*) from public.watchlist) <> 2 then raise exception 'B deleted A''s watchlist'; end if;
  if (select count(*) from public.devices) <> 2 then raise exception 'B deleted A''s device'; end if;
  if (select revoked_at from public.devices where id = 'device-aaaaaaa2') is not null then
    raise exception 'B revoked A''s device';
  end if;
  if (select revoked_at from public.devices where id = 'device-aaaaaaaa') is null then
    raise exception 'B un-revoked A''s device';
  end if;
  -- The forgotten device deletes its own row as it signs out.
  delete from public.devices where id = 'device-aaaaaaaa';
  delete from public.watchlist where title_id = 604;
  if (select count(*) from public.devices) <> 1 or (select count(*) from public.watchlist) <> 1 then
    raise exception 'A could not delete own rows';
  end if;
end;
$$;

-- ------------------------------------------------------------ deletion processor (service role)
-- A still owns a profile, a watchlist row, history, a rating, a device and the
-- request: all of it must go with the auth user.
reset role;
do $$
declare n integer;
begin
  n := public.lf_process_account_deletions();
  if n <> 1 then raise exception 'processor should delete 1 account, got %', n; end if;
  if exists (select 1 from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'auth user A still exists';
  end if;
  if (select count(*) from public.profiles) + (select count(*) from public.watchlist)
     + (select count(*) from public.history) + (select count(*) from public.ratings)
     + (select count(*) from public.devices) + (select count(*) from public.account_deletion_requests) <> 0 then
    raise exception 'rows of A did not cascade with the auth user';
  end if;
end;
$$;

select 'RLS check passed' as result;
rollback;
