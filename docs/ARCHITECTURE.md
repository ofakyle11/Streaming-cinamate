# Last Frame — Architecture (Wave 0)

Vite + React 18 + TypeScript SPA with plain CSS (glass-motion design language).
Everything runs on mock adapters when no env vars are set.

## Layout

```
src/
  main.tsx            Entry: mounts <ToastProvider><App/></ToastProvider>, imports styles/theme.css
  App.tsx             Renders the router
  app/
    router.tsx        Route table; pages are lazy-loaded (code split per page)
    AppLayout.tsx     Shell: Navbar, <Outlet/>, footer
  pages/              Route components (Home, Search, Genre, Title, MyList, Profiles, Account, Plans, NotFound)
  components/         Feature components (Hero, Row, MovieCard, DetailModal, Navbar)
    ui/               Primitives: Button, IconButton, Skeleton, Toast (barrel: ui/index.ts)
  features/profiles/  Gradient avatars, name/kids rules, ProfileAvatar, ProfileEditor dialog, navbar ProfileMenu
  auth/               AuthProvider + useAuth (guest mode default), clearLocalData (delete-my-data)
  state/store.ts      Zustand store: profiles, watchlist, history, ratings slices
  hooks/              Thin hooks over the store (useProfiles, useWatchlist, useHistory, useRatings)
  services/
    index.ts          Service locator: live vs mock per env; TMDB -> UI mapping (toMovie, loadHomeCatalog)
    types.ts          Service interfaces + domain types
    tmdb|auth|db/     mock.ts + live.ts adapters
    billing|analytics/ mock.ts only on the client (no Stripe SDK or keys, ever)
    billing/types.ts  BillingAdapter (getPlans, getSubscription, startCheckout), plan feature table, price/URL helpers;
                      exposed as `billingAdapter` from services/index.ts and used by /plans
  data/movies.ts      Static catalogue helpers
  pwa/                config.ts (manifest + workbox image caching), install.ts (install prompt controller/hook)
  styles/
    tokens.css        Design tokens (color, radius, blur, motion)
    primitives.css    Styles for ui/ primitives
    theme.css         Imports tokens + primitives; app styles; prefers-reduced-motion overrides
  test/               Vitest setup and integration tests
  services/db/sync.ts        Pure store <-> row mapping + last-write-wins merge
  services/db/syncEngine.ts  startCloudSync: initial pull, merge, debounced upserts, persisted retry queue
  services/supabase.ts       One lazily loaded Supabase client shared by auth + db
netlify/functions/    Serverless functions (health.ts)
supabase/schema.sql   Sync tables: profiles, watchlist, history, ratings (PK starts with user_id;
                      RLS own-row policies on auth.uid(); soft deletes; LWW trigger ignores stale upserts)
supabase/seed.sql     Local-dev demo user + rows (`supabase db reset`)
supabase/migrations/  SQL (RLS on every table, policies keyed on auth.uid()); schema.sql ships here too
docs/                 AGENTS.md (team rules), ARCHITECTURE.md (this file)
```

## Data flow

Page/component -> hook -> zustand store (user state), or -> `services` (catalogue/auth/db).
`services.mode` reports which adapters are live.

Cloud sync: while a user is signed in, `AuthProvider` runs `startCloudSync` against `services.db`.
It pulls all rows (tombstones included), merges them with the local store (newer `updatedAt` wins;
unsent local edits are kept in `lf.sync.pending.<userId>`), then upserts local edits after a quiet
period (debounced, retried with backoff, flushed on sign-out/page hide). The mock DB returns `null`
from `pullSnapshot`, which switches sync off, so guests and mock mode stay fully local.
After the first merge the account that owns the local data is recorded in `lf.sync.owner`. Guest
data (no owner) is merged into the first account that signs in; if a different account signs in
while another account's data is still on the device, the store is replaced by that account's
server snapshot and nothing local is uploaded. Signing out stops sync and resets the synced store
data (profiles, lists, history, ratings) to a fresh guest, since the cloud holds the account's copy.

## Environment

| Var | Effect |
| --- | --- |
| `VITE_TMDB_PROXY` | Live TMDB through our proxy |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Live auth + db (both required; Supabase SDK is lazy-loaded). Auth: magic link + Google OAuth; add `<origin>/account` to Supabase redirect URLs |

None are required; with none set the app is fully mocked.

## PWA

`vite-plugin-pwa` (see `src/pwa/config.ts`): manifest "Last Frame" (theme `#0b0b12`), icons generated at build
from `public/logo.svg` via `pwa-assets.config.ts`, generateSW service worker precaching the app shell and caching
images cache-first (`lf-images`, 250 entries / 30 days). `main.tsx` captures `beforeinstallprompt`; the Account
page's `InstallAppCard` offers "Install app" (manual Add to Home Screen hint on iOS). The SW is build-only.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must all pass.
