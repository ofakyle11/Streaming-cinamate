-- Account data deletion queue.
-- The client can only *request* erasure (deleting auth.users needs the service
-- role, which never ships to the browser). A backend job with the service role
-- processes pending rows and deletes the user's data + auth record.

create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists account_deletion_requests_user_id_idx
  on public.account_deletion_requests (user_id);

alter table public.account_deletion_requests enable row level security;

-- Users may queue a request for themselves only.
drop policy if exists "deletion_requests_insert_own" on public.account_deletion_requests;
create policy "deletion_requests_insert_own"
  on public.account_deletion_requests
  for insert
  to authenticated
  with check (user_id = auth.uid() and processed_at is null);

-- Users may see their own requests (e.g. to show "pending" state).
drop policy if exists "deletion_requests_select_own" on public.account_deletion_requests;
create policy "deletion_requests_select_own"
  on public.account_deletion_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- No update/delete policies: only the service role (which bypasses RLS) may
-- mark requests processed or remove them.
