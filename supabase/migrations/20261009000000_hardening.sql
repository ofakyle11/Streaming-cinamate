-- Hardening pass (security evaluation of 2026-10-09). Idempotent.
--
-- 1. Per-user row quotas (profiles 200, watchlist 5000, history 10000,
--    ratings 10000, devices 50) so one confirmed email cannot fill the database.
-- 2. One pending deletion request per user.
-- 3. Table privileges narrowed to what PostgREST needs: `authenticated` loses
--    TRUNCATE, TRIGGER and REFERENCES (TRUNCATE ignores RLS).
-- 4. Display name and avatar metadata set through the public sign-up endpoint
--    are dropped for email accounts, so a pre-registered address cannot plant
--    a name the real owner later sees on their account page.
-- 5. The deletion processor pins an empty search_path and logs each run.
-- 6. Stale device rows expire; both housekeeping jobs are scheduled here when
--    pg_cron is available (Supabase: Integrations -> Cron), so the 24-hour
--    deletion promise no longer depends on a step run by hand.

-- --------------------------------------------------------------- 1. quotas

create or replace function public.lf_row_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_rows integer := tg_argv[0]::integer;
  uid uuid;
  n bigint;
begin
  -- Statement-level AFTER INSERT with a transition table: only rows that were
  -- really inserted appear in it (an upsert that ended as an update does not),
  -- so a user at the cap can still sync and remove existing rows, and the
  -- count already includes every row of this statement, so a bulk insert
  -- cannot jump the cap. Runs as the invoker, so under RLS it only ever sees
  -- the caller's own rows.
  for uid in select distinct user_id from inserted loop
    execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
      into n using uid;
    if n > max_rows then
      raise exception '% quota of % rows exceeded', tg_table_name, max_rows
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.lf_row_quota() from public, anon, authenticated;

-- Quotas count tombstones too (deletion markers stay until the account goes),
-- so each cap leaves room for churn: 200 profile rows for a 5-profile UI.
drop trigger if exists profiles_quota on public.profiles;
create trigger profiles_quota after insert on public.profiles
  referencing new table as inserted for each statement
  execute function public.lf_row_quota('200');
drop trigger if exists watchlist_quota on public.watchlist;
create trigger watchlist_quota after insert on public.watchlist
  referencing new table as inserted for each statement
  execute function public.lf_row_quota('5000');
drop trigger if exists history_quota on public.history;
create trigger history_quota after insert on public.history
  referencing new table as inserted for each statement
  execute function public.lf_row_quota('10000');
drop trigger if exists ratings_quota on public.ratings;
create trigger ratings_quota after insert on public.ratings
  referencing new table as inserted for each statement
  execute function public.lf_row_quota('10000');
drop trigger if exists devices_quota on public.devices;
create trigger devices_quota after insert on public.devices
  referencing new table as inserted for each statement
  execute function public.lf_row_quota('50');

-- --------------------------------------------------------------- 2. one pending request

create unique index if not exists account_deletion_requests_pending_uidx
  on public.account_deletion_requests (user_id) where processed_at is null;

-- --------------------------------------------------------------- 3. privileges

revoke all on public.profiles, public.watchlist, public.history, public.ratings, public.devices
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.profiles, public.watchlist, public.history, public.ratings, public.devices
  to authenticated;

revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select, insert on public.account_deletion_requests to authenticated;

-- --------------------------------------------------------------- 4. metadata from sign-up

-- Runs before insert on auth.users. OAuth providers (Google) set app_metadata.provider,
-- and their name/avatar are genuine; the email provider never sets them, so any
-- such keys on an email account came from the public sign-up call.
create or replace function public.lf_scrub_signup_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email' then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      - array['display_name', 'full_name', 'name', 'avatar_url', 'picture'];
  end if;
  return new;
end;
$$;

revoke all on function public.lf_scrub_signup_metadata() from public, anon, authenticated;

drop trigger if exists lf_scrub_signup_metadata on auth.users;
create trigger lf_scrub_signup_metadata
  before insert on auth.users
  for each row execute function public.lf_scrub_signup_metadata();

-- --------------------------------------------------------------- 5. processor

create or replace function public.lf_process_account_deletions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending uuid;
  processed integer := 0;
begin
  for pending in
    select distinct r.user_id
      from public.account_deletion_requests r
     where r.processed_at is null
  loop
    delete from auth.users where id = pending;
    if found then
      processed := processed + 1;
    end if;
  end loop;
  raise log 'lf_process_account_deletions: % account(s) deleted', processed;
  return processed;
end;
$$;

revoke all on function public.lf_process_account_deletions() from public, anon, authenticated;
grant execute on function public.lf_process_account_deletions() to service_role;

-- --------------------------------------------------------------- 6. device retention + schedule

-- A device forgotten more than 30 days ago, or not seen for 180 days, is gone.
create or replace function public.lf_expire_devices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.devices
   where (revoked_at is not null and revoked_at < now() - interval '30 days')
      or last_seen_at < now() - interval '180 days';
  get diagnostics n = row_count;
  raise log 'lf_expire_devices: % row(s) removed', n;
  return n;
end;
$$;

revoke all on function public.lf_expire_devices() from public, anon, authenticated;
grant execute on function public.lf_expire_devices() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
      where jobname in ('lf-process-account-deletions', 'lf-expire-devices');
    perform cron.schedule('lf-process-account-deletions', '*/15 * * * *',
                          'select public.lf_process_account_deletions()');
    perform cron.schedule('lf-expire-devices', '17 3 * * *',
                          'select public.lf_expire_devices()');
  else
    raise notice 'pg_cron is not installed: schedule lf_process_account_deletions and lf_expire_devices by hand (docs/SUPABASE.md)';
  end if;
end;
$$;
