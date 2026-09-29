-- Last Frame cloud sync schema.
--
-- Mirrors the client store (src/state/store.ts): viewing profiles plus each
-- profile's watchlist, watch history and ratings. Every row belongs to one
-- auth user (user_id = auth.uid()); Row Level Security confines each signed-in
-- user to their own rows and anonymous clients to nothing.
--
-- Sync model (src/services/db/syncEngine.ts): the client upserts rows with a
-- client-side `updated_at`; deletions are soft (`deleted = true`) so they reach
-- other devices. Last write wins, enforced here too: an upsert carrying an
-- older `updated_at` than the stored row is ignored.
--
-- Idempotent: safe to run repeatedly (SQL editor or `psql -f`). The same SQL
-- ships as a migration in supabase/migrations/ for `supabase db push`.

-- --------------------------------------------------------------- helpers

-- Last-write-wins guard for upserts. Also clamps timestamps from clocks that
-- run far ahead, so one bad device cannot win every future conflict.
create or replace function public.lf_sync_last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot change';
    end if;
    if new.updated_at < old.updated_at then
      return null; -- stale write: keep the newer stored row
    end if;
  end if;
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles

create table if not exists public.profiles (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 64),
  name       text        not null check (char_length(name) between 1 and 50),
  avatar     text        not null default '' check (char_length(avatar) <= 32),
  kid        boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, id)
);

-- --------------------------------------------------------------- watchlist

create table if not exists public.watchlist (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text        not null check (char_length(profile_id) between 1 and 64),
  title_id   integer     not null check (title_id > 0),
  added_at   timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, profile_id, title_id)
);

-- --------------------------------------------------------------- history

create table if not exists public.history (
  user_id         uuid             not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id      text             not null check (char_length(profile_id) between 1 and 64),
  title_id        integer          not null check (title_id > 0),
  position        double precision not null default 0 check (position >= 0),
  duration        double precision not null default 0 check (duration >= 0),
  last_watched_at timestamptz      not null default now(),
  completed       boolean          not null default false,
  updated_at      timestamptz      not null default now(),
  deleted         boolean          not null default false,
  primary key (user_id, profile_id, title_id)
);

-- --------------------------------------------------------------- ratings

create table if not exists public.ratings (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text        not null check (char_length(profile_id) between 1 and 64),
  title_id   integer     not null check (title_id > 0),
  rating     smallint    not null check (rating between 1 and 5),
  rated_at   timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (user_id, profile_id, title_id)
);

-- --------------------------------------------------------------- triggers + indexes

drop trigger if exists profiles_last_write_wins on public.profiles;
create trigger profiles_last_write_wins
  before insert or update on public.profiles
  for each row execute function public.lf_sync_last_write_wins();

drop trigger if exists watchlist_last_write_wins on public.watchlist;
create trigger watchlist_last_write_wins
  before insert or update on public.watchlist
  for each row execute function public.lf_sync_last_write_wins();

drop trigger if exists history_last_write_wins on public.history;
create trigger history_last_write_wins
  before insert or update on public.history
  for each row execute function public.lf_sync_last_write_wins();

drop trigger if exists ratings_last_write_wins on public.ratings;
create trigger ratings_last_write_wins
  before insert or update on public.ratings
  for each row execute function public.lf_sync_last_write_wins();

-- The client pulls everything for a user ordered by updated_at.
create index if not exists profiles_user_updated_idx  on public.profiles  (user_id, updated_at);
create index if not exists watchlist_user_updated_idx on public.watchlist (user_id, updated_at);
create index if not exists history_user_updated_idx   on public.history   (user_id, updated_at);
create index if not exists ratings_user_updated_idx   on public.ratings   (user_id, updated_at);

-- --------------------------------------------------------------- privileges

revoke all on public.profiles, public.watchlist, public.history, public.ratings from anon;
grant select, insert, update, delete on public.profiles, public.watchlist, public.history, public.ratings to authenticated;

-- --------------------------------------------------------------- row level security

alter table public.profiles  enable row level security;
alter table public.watchlist enable row level security;
alter table public.history   enable row level security;
alter table public.ratings   enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (user_id = auth.uid());

-- watchlist
drop policy if exists "watchlist_select_own" on public.watchlist;
create policy "watchlist_select_own" on public.watchlist
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "watchlist_insert_own" on public.watchlist;
create policy "watchlist_insert_own" on public.watchlist
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "watchlist_update_own" on public.watchlist;
create policy "watchlist_update_own" on public.watchlist
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "watchlist_delete_own" on public.watchlist;
create policy "watchlist_delete_own" on public.watchlist
  for delete to authenticated using (user_id = auth.uid());

-- history
drop policy if exists "history_select_own" on public.history;
create policy "history_select_own" on public.history
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "history_insert_own" on public.history;
create policy "history_insert_own" on public.history
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "history_update_own" on public.history;
create policy "history_update_own" on public.history
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "history_delete_own" on public.history;
create policy "history_delete_own" on public.history
  for delete to authenticated using (user_id = auth.uid());

-- ratings
drop policy if exists "ratings_select_own" on public.ratings;
create policy "ratings_select_own" on public.ratings
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "ratings_insert_own" on public.ratings;
create policy "ratings_insert_own" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ratings_update_own" on public.ratings;
create policy "ratings_update_own" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ratings_delete_own" on public.ratings;
create policy "ratings_delete_own" on public.ratings
  for delete to authenticated using (user_id = auth.uid());
