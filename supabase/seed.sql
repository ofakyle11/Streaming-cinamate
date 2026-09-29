-- Local development seed (run by `supabase db reset`; never run against production).
--
-- Creates a demo auth user with two viewing profiles and some watchlist,
-- history and ratings rows, so a local Supabase stack shows synced data right
-- after signing in with a magic link to demo@lastframe.local (Inbucket
-- captures the email at http://localhost:54324). No password is set.
-- Requires supabase/schema.sql (or its migration) to have been applied.

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'demo@lastframe.local',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Demo Viewer"}',
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (user_id, id, name, avatar, kid, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 'Demo', 'aurora', false, now() - interval '30 days', now() - interval '30 days'),
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-kids', 'Kids', 'meadow', true,  now() - interval '29 days', now() - interval '29 days')
on conflict (user_id, id) do nothing;

insert into public.watchlist (user_id, profile_id, title_id, added_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 27205,  now() - interval '3 days', now() - interval '3 days'),
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 157336, now() - interval '2 days', now() - interval '2 days'),
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-kids', 862,    now() - interval '1 day',  now() - interval '1 day')
on conflict (user_id, profile_id, title_id) do nothing;

insert into public.history (user_id, profile_id, title_id, position, duration, last_watched_at, completed, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 603,   2400, 8160, now() - interval '6 hours', false, now() - interval '6 hours'),
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 155,   9120, 9120, now() - interval '5 days',  true,  now() - interval '5 days'),
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-kids', 862,   1200, 4860, now() - interval '1 day',   false, now() - interval '1 day')
on conflict (user_id, profile_id, title_id) do nothing;

insert into public.ratings (user_id, profile_id, title_id, rating, rated_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 155, 5, now() - interval '5 days', now() - interval '5 days'),
  ('11111111-1111-4111-8111-111111111111', 'seed-profile-main', 603, 4, now() - interval '4 days', now() - interval '4 days')
on conflict (user_id, profile_id, title_id) do nothing;
