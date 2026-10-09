-- Row Level Security check for every per-user table.
--
-- Signs in as two users (A and B) through the JWT claims PostgREST uses, writes
-- rows as A, then proves that B cannot read, change or delete them, that anon
-- sees nothing, that nobody can forge a row for someone else, that a revoked
-- device stays revoked through the client's own upsert, that passwords are
-- stripped from auth.users, that the admin allow-list answers only for the
-- listed address and cannot be edited by a client, and that deleting the auth
-- user cascades. Each
-- block raises on failure, so `psql -v ON_ERROR_STOP=1 -f` exits non-zero.
--
-- Runs after the migrations (and supabase/tests/auth_shim.sql on plain
-- PostgreSQL). Everything happens in one transaction that is rolled back.

begin;

insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@lastframe.test', '$2a$10$attacker-chosen-password-hash',
   '{"provider":"email"}', '{"display_name":"Planted by attacker","avatar_url":"https://evil.test/a.png","theme":"dark"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@lastframe.test', null,
   '{"provider":"google"}', '{"full_name":"Bea","avatar_url":"https://lh3.googleusercontent.com/b"}')
on conflict (id) do nothing;

-- ------------------------------------------------------------ sign-up metadata is scrubbed for email accounts
do $$
declare m jsonb;
begin
  select raw_user_meta_data into m from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if m ? 'display_name' or m ? 'avatar_url' then
    raise exception 'planted name/avatar survived on an email account: %', m;
  end if;
  if not (m ? 'theme') then raise exception 'unrelated metadata was dropped'; end if;
  select raw_user_meta_data into m from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if not (m ? 'full_name' and m ? 'avatar_url') then
    raise exception 'OAuth name/avatar were dropped';
  end if;
end;
$$;

-- ------------------------------------------------------------ every table in public has RLS
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'table public.% has no row level security', t;
  end loop;
end;
$$;

-- ------------------------------------------------------------ privileges: no TRUNCATE for clients, no processor for clients
do $$
declare t text;
begin
  foreach t in array array['profiles', 'watchlist', 'history', 'ratings', 'devices', 'account_deletion_requests', 'admin_users'] loop
    if has_table_privilege('authenticated', format('public.%I', t), 'truncate')
       or has_table_privilege('authenticated', format('public.%I', t), 'trigger')
       or has_table_privilege('anon', format('public.%I', t), 'select') then
      raise exception 'public.% grants more than PostgREST needs', t;
    end if;
  end loop;
  foreach t in array array['lf_process_account_deletions()', 'lf_expire_devices()', 'lf_row_quota()', 'lf_strip_password()', 'lf_scrub_signup_metadata()'] loop
    if has_function_privilege('authenticated', format('public.%s', t), 'execute')
       or has_function_privilege('anon', format('public.%s', t), 'execute') then
      raise exception 'clients can execute public.%', t;
    end if;
  end loop;
end;
$$;

-- Only the owner (here: the superuser running the check) adds admins.
insert into public.admin_users (email, note) values ('a@lastframe.test', 'test admin')
on conflict (email) do nothing;

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
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","email":"A@Lastframe.test"}';

-- ------------------------------------------------------------ admin allow-list, as A (listed)
do $$
begin
  if not public.lf_is_admin() then raise exception 'A is on the allow-list but lf_is_admin() is false'; end if;
  if (select count(*) from public.admin_users) <> 1 then raise exception 'A should see exactly their own admin row'; end if;
  begin
    insert into public.admin_users (email) values ('b@lastframe.test');
    raise exception 'A added an admin';
  exception when insufficient_privilege then null; -- expected: no grant
  end;
  begin
    update public.admin_users set note = 'hijacked';
    raise exception 'A edited the admin list';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.admin_users;
    raise exception 'A deleted from the admin list';
  exception when insufficient_privilege then null;
  end;
end;
$$;

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
    insert into public.watchlist (user_id, profile_id, title_id, added_at, updated_at)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'p1', 1, now(), now());
    raise exception 'A inserted a watchlist row for B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.history (user_id, profile_id, title_id, position, duration, last_watched_at, completed, updated_at)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'p1', 1, 0, 1, now(), false, now());
    raise exception 'A inserted a history row for B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.ratings (user_id, profile_id, title_id, rating, rated_at, updated_at)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'p1', 1, 3, now(), now());
    raise exception 'A inserted a rating for B';
  exception when insufficient_privilege then null;
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

-- A cannot hand any row over to B.
do $$
declare t text; k text;
begin
  for t, k in select * from (values
      ('profiles', 'id = ''p1'''),
      ('watchlist', 'title_id = 603'),
      ('history', 'title_id = 603'),
      ('ratings', 'title_id = 603'),
      ('devices', 'id = ''device-aaaaaaaa''')) as v(t, k)
  loop
    begin
      execute format('update public.%I set user_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'' where %s', t, k);
      raise exception 'A moved a % row to B', t;
    exception when insufficient_privilege or raise_exception then null; -- RLS or the trigger
    end;
  end loop;
end;
$$;

-- A cannot queue a second deletion while one is pending, and cannot TRUNCATE.
do $$
begin
  begin
    insert into public.account_deletion_requests default values;
    raise exception 'A queued a second deletion request';
  exception when unique_violation then null;
  end;
  begin
    truncate public.watchlist;
    raise exception 'A truncated a table';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Row quotas: the 200th profile row is the last one.
do $$
declare i integer;
begin
  for i in 2..200 loop
    insert into public.profiles (id, name, created_at, updated_at) values ('p' || i, 'P' || i, now(), now());
  end loop;
  begin
    insert into public.profiles (id, name, created_at, updated_at) values ('p201', 'P201', now(), now());
    raise exception 'A created a 201st profile';
  exception when check_violation then null; -- expected: quota
  end;
  -- At the cap the client's real write path (upsert of an existing key) must
  -- still work, otherwise a full account can neither sync nor remove rows.
  insert into public.profiles (id, name, created_at, updated_at) values ('p1', 'renamed', now(), now())
    on conflict (user_id, id) do update set name = excluded.name, updated_at = excluded.updated_at;
  if (select name from public.profiles where id = 'p1') <> 'renamed' then
    raise exception 'upsert at quota did not update the existing row';
  end if;
  update public.profiles set name = 'Ada' where id = 'p1';
  -- A bulk insert cannot jump the cap either.
  begin
    insert into public.profiles (id, name, created_at, updated_at)
      select 'q' || g, 'Q' || g, now(), now() from generate_series(1, 5) g;
    raise exception 'A bulk-inserted past the profiles quota';
  exception when check_violation then null; -- expected: quota
  end;
  if (select count(*) from public.profiles) <> 200 then
    raise exception 'bulk insert past quota left rows behind';
  end if;
  delete from public.profiles where id <> 'p1';
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
  -- A user cannot mark their own deletion request processed (no UPDATE grant at all).
  begin
    update public.account_deletion_requests set processed_at = now();
  exception when insufficient_privilege then null; -- expected: no grant
  end;
  if exists (select 1 from public.account_deletion_requests where processed_at is not null) then
    raise exception 'A marked a deletion request processed';
  end if;
end;
$$;

-- ------------------------------------------------------------ as user B: read nothing
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","email":"b@lastframe.test"}';

do $$
begin
  if public.lf_is_admin() then raise exception 'B is not on the allow-list but lf_is_admin() is true'; end if;
  if (select count(*) from public.admin_users) <> 0 then raise exception 'B can see admin rows'; end if;
end;
$$;

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
  foreach t in array array['profiles', 'watchlist', 'history', 'ratings', 'devices', 'account_deletion_requests', 'admin_users'] loop
    begin
      -- Either no grant at all (revoked) or RLS with no anon policy: zero rows.
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'anon can read rows from %', t; end if;
    exception when insufficient_privilege then null; -- expected: no grant
    end;
  end loop;
  begin
    if public.lf_is_admin() then raise exception 'anon is an admin'; end if;
  exception when insufficient_privilege then null; -- expected: no execute grant
  end;
end;
$$;

-- ------------------------------------------------------------ back as A: rows intact, own deletes work
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","email":"a@lastframe.test"}';
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

-- ------------------------------------------------------------ device retention (service role)
set local role service_role;
do $$
declare n integer;
begin
  n := public.lf_expire_devices();
  if n <> 0 then raise exception 'expire_devices removed % fresh row(s)', n; end if;
end;
$$;
reset role;
-- (last_seen_at is server-set on every write, so age the row through revoked_at.)
update public.devices set revoked_at = now() - interval '40 days' where id = 'device-aaaaaaa2';
set local role service_role;
do $$
declare n integer;
begin
  n := public.lf_expire_devices();
  if n <> 1 then raise exception 'expire_devices should remove 1 stale row, removed %', n; end if;
end;
$$;

-- ------------------------------------------------------------ deletion processor (service role)
-- A still owns a profile, a watchlist row, history, a rating and the request:
-- all of it must go with the auth user.
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

reset role;
select 'RLS check passed' as result;
rollback;
