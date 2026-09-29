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
  state/store.ts      Zustand store: profiles, watchlist, history, ratings slices
  hooks/              Thin hooks over the store (useProfiles, useWatchlist, useHistory, useRatings)
  services/
    index.ts          Service locator: live vs mock per env; TMDB -> UI mapping (toMovie, loadHomeCatalog)
    types.ts          Service interfaces + domain types
    tmdb|auth|db/     mock.ts + live.ts adapters
    billing|analytics/ mock.ts only on the client (no Stripe SDK or keys, ever)
  data/movies.ts      Static catalogue helpers
  pwa/                config.ts (manifest + workbox image caching), install.ts (install prompt controller/hook)
  styles/
    tokens.css        Design tokens (color, radius, blur, motion)
    primitives.css    Styles for ui/ primitives
    theme.css         Imports tokens + primitives; app styles; prefers-reduced-motion overrides
  test/               Vitest setup and integration tests
netlify/functions/    Serverless functions (health.ts)
docs/                 AGENTS.md (team rules), ARCHITECTURE.md (this file)
```

## Data flow

Page/component -> hook -> zustand store (user state), or -> `services` (catalogue/auth/db).
`services.mode` reports which adapters are live.

## Environment

| Var | Effect |
| --- | --- |
| `VITE_TMDB_PROXY` | Live TMDB through our proxy |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Live auth + db |

None are required; with none set the app is fully mocked.

## PWA

`vite-plugin-pwa` (see `src/pwa/config.ts`): manifest "Last Frame" (theme `#0b0b12`), icons generated at build
from `public/logo.svg` via `pwa-assets.config.ts`, generateSW service worker precaching the app shell and caching
images cache-first (`lf-images`, 250 entries / 30 days). `main.tsx` captures `beforeinstallprompt`; the Account
page's `InstallAppCard` offers "Install app" (manual Add to Home Screen hint on iOS). The SW is build-only.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must all pass.
