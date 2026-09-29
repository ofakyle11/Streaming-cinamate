-- Account deletion processor.
--
-- The client already hard-deletes its synced rows (RLS delete-own policies)
-- and then queues a row in public.account_deletion_requests. This function
-- finishes the job: for every pending request it deletes the auth user, and
-- the sync tables (profiles, watchlist, history, ratings) plus the request
-- row itself go with it through their `on delete cascade` foreign keys.
--
-- Meant for pg_cron or a service-role job, never for clients, e.g.:
--   select cron.schedule('lf-process-account-deletions', '*/15 * * * *',
--                        'select public.lf_process_account_deletions()');
--
-- Returns the number of accounts processed. Idempotent: safe to re-run.

create or replace function public.lf_process_account_deletions()
returns integer
language plpgsql
security definer
set search_path = public, auth
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
  return processed;
end;
$$;

revoke all on function public.lf_process_account_deletions() from public, anon, authenticated;
grant execute on function public.lf_process_account_deletions() to service_role;
