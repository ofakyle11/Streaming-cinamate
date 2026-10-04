# Last Frame — Architecture

_Originally written for Wave 0; refreshed after the Quality & Polish stream (brand, errors,
SEO, a11y)._

Vite + React 18 + TypeScript SPA with plain CSS (glass-motion design language).
Everything runs on mock adapters when no env vars are set.

## Layout

```
src/
  main.tsx            Entry: mounts <ToastProvider><App/></ToastProvider>, imports styles/theme.css
  App.tsx             Renders the router
  app/
    router.tsx        Route table; pages are lazy-loaded (code split per page)
    AppLayout.tsx     Shell: skip link, Navbar, #main > ErrorBoundary > Suspense > <Outlet/>,
                      OfflineBanner, RouteAnnouncer, footer
  pages/              Route components (Home, Search, Genre, Title, MyList, Profiles, Account, Plans, Brand, NotFound)
  components/         Feature components (Hero, Row, MovieCard, Navbar; title/TrailerModal)
    a11y/             RouteAnnouncer (route-change announcement + focus reset)
    brand/            marks.ts (four mark directions + colourways as path data, ACTIVE_BRAND, SVG
                      string builders), BrandMark, Lockup/Wordmark, activeBrand.ts (preview
                      override hook), useBrandFavicon
    errors/           ErrorBoundary, RouteError, ErrorCard, OfflineBanner
    ui/               Primitives: Button, IconButton, Skeleton, Toast (barrel: ui/index.ts)
  features/profiles/  Gradient avatars, name/kids rules, ProfileAvatar, ProfileEditor dialog, navbar ProfileMenu
  auth/               AuthProvider + useAuth (guest mode default), clearLocalData (delete-my-data wipes local data, then clears the lf-images PWA image cache)
  state/store.ts      Zustand store: profiles, watchlist, history, ratings slices
  hooks/              Thin hooks over the store (useProfiles, useWatchlist, useHistory, useRatings)
                      + useMeta, useFocusTrap, useRovingFocus, useOnlineStatus
  services/
    index.ts          Service locator: live vs mock per env; TMDB -> UI mapping (toMovie, loadHomeCatalog)
    types.ts          Service interfaces + domain types
    tmdb|auth|db/     mock.ts + live.ts adapters
    billing|analytics/ mock.ts only on the client (no Stripe SDK or keys, ever)
    billing/types.ts  BillingAdapter (getPlans, getSubscription, startCheckout), plan feature table, price/URL helpers;
                      exposed as `billingAdapter` from services/index.ts and used by /plans
    retry.ts          withRetry / fetchWithRetry (exponential backoff) for live adapters
  data/movies.ts      Static catalogue helpers
  pwa/                config.ts (manifest + workbox image caching), install.ts (install prompt controller/hook), imageCache.ts (clearImageCache for delete-my-data)
  styles/
    tokens.css        Design tokens (color, radius, blur, motion)
    primitives.css    Styles for ui/ primitives
    theme.css         Imports tokens + primitives; app styles; prefers-reduced-motion overrides
    brand.css         Navbar brand-mark hover styles (imported by Navbar.tsx)
    brand-kit.css     /brand deck, lockup + wordmark styles (imported by BrandPage.tsx)
    errors.css        Error card + offline banner (imported by errors/ components)
    a11y.css          Skip link, focus rings, main target, .sr-only (imported by AppLayout.tsx)
    nav.css           Mobile primary nav toggle + glass dropdown (imported by Navbar.tsx)
  test/               Vitest setup and integration tests
  services/db/sync.ts        Pure store <-> row mapping + last-write-wins merge
  services/db/syncEngine.ts  startCloudSync: initial pull, merge, debounced upserts, persisted retry queue
  services/supabase.ts       One lazily loaded Supabase client shared by auth + db
netlify/functions/    Serverless functions (health.ts, tmdb.ts proxy); served at /api/* via netlify.toml
supabase/schema.sql   Sync tables: profiles, watchlist, history, ratings (PK starts with user_id;
                      RLS own-row policies on auth.uid(); soft deletes; LWW trigger ignores stale upserts)
supabase/seed.sql     Local-dev demo user + rows (`supabase db reset`)
supabase/migrations/  SQL (RLS on every table, policies keyed on auth.uid()); schema.sql ships here too
public/               favicon.svg, favicon-32.png, mask-icon.svg, apple-touch-icon.png,
                      icons/icon.svg, brand/*.svg (downloadable kit files), robots.txt, sitemap.xml
scripts/              generate-icons.mjs, generate-brand-assets.mjs, generate-sitemap.mjs,
                      tasks.json (task board)
docs/                 AGENTS.md (team rules + task log), ARCHITECTURE.md (this file),
                      KEYS.md (env vars), A11Y.md (accessibility)
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

| Var                                                            | Effect                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_TMDB_PROXY`                                              | Live TMDB through our proxy                                                                                                                    |
| `TMDB_API_KEY` (server-only)                                   | Used by the Netlify TMDB proxy function, never the client                                                                                      |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`                 | Live auth + db (both required; Supabase SDK is lazy-loaded). Auth: magic link + Google OAuth; add `<origin>/account` to Supabase redirect URLs |
| `VITE_PLAUSIBLE_DOMAIN` (+ optional `VITE_PLAUSIBLE_API_HOST`) | Plausible analytics (`services/analytics/plausible.ts`); else console mock                                                                     |

See `docs/KEYS.md` for the full list, including tooling-only variables.

Analytics: `usePageViews()` in `AppLayout` sends a page view per route change; custom events
(`search`, `add-to-list`, `play-trailer`, `title-open`) go through `track()` in `services/analytics/track.ts`.

None are required; with none set the app is fully mocked. Full details, where to get each
value and how to set it in Netlify: [KEYS.md](KEYS.md).

The production CSP in `netlify.toml` allows `https://*.supabase.co` and `wss://*.supabase.co` in `connect-src`; a self-hosted (non-`*.supabase.co`) Supabase URL must be added to `connect-src` by hand.

## PWA

`vite-plugin-pwa` (see `src/pwa/config.ts`): manifest "Last Frame" (theme `#0b0b12`), icons generated at build
from `public/logo.svg` via `pwa-assets.config.ts`, generateSW service worker precaching the app shell and caching
images cache-first (`lf-images`, 250 entries / 30 days). `main.tsx` captures `beforeinstallprompt`; the Account
page's `InstallAppCard` offers "Install app" (manual Add to Home Screen hint on iOS). The SW is build-only.

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must all pass.

## Styling conventions

Feature styles live in their own file under `src/styles/` and are imported by the component
that needs them (`brand.css`, `errors.css`, `a11y.css`, `nav.css`), which keeps `theme.css` small. Use
the tokens in `tokens.css`, not literal colours. Glass surfaces use the `.glass` class with
translucent backgrounds and `backdrop-filter` blur. The global `prefers-reduced-motion` block
in `theme.css` switches off animations and transitions everywhere, so new motion only needs
extra handling if it's driven by JS (for example, the hero rotation).

Under the Lumen brand the tokens are split in two: `tokens.css` holds the shared tokens and
the light theme values, and `themes.css` redefines the colour tokens for dark (device
preference, or an explicit `data-theme` on `<html>`). Phase 1 ships with
`data-theme="dark"` as the default; phase 2 adds the theme switch.

## Brand

- **One source.** `components/brand/marks.ts` holds four mark directions (Monogram, Frame,
  Strip, Countdown) as path data on a 64-grid, four colourways from existing tokens, and
  `ACTIVE_BRAND`, the direction the app ships with (currently Countdown / Aurora). String
  builders (`markSvg`, `appIconSvg`, `monoSvg`, `lockupSvg`) make standalone SVGs from the
  same layers; `BrandMark` mirrors them as JSX (token colours, `useId` gradients). Glyphs are
  paths, so no mark depends on a loaded font.
- **Where it shows.** The Navbar draws `BrandMark` for `useActiveBrand()` (`activeBrand.ts`):
  `ACTIVE_BRAND` unless the kit page has stored a preview in `localStorage` (`lf.brand`), in
  which case every tab in that browser follows it and `useBrandFavicon` (mounted in
  `AppLayout`) swaps the SVG favicon to match. `Lockup` wraps a decorative mark plus the
  live-text `Wordmark` as one `role="img"`.
- **Static icons.** `node scripts/generate-brand-assets.mjs` writes
  `public/brand/lf-<mark>-{mark,icon,lockup}.svg` for all four directions (Aurora) and, from
  `ACTIVE_BRAND`, `favicon.svg`, `mask-icon.svg` (black silhouette), `icons/icon.svg`
  (full-bleed maskable) and `logo.svg` (the PWA icon source). `node scripts/generate-icons.mjs`
  then rasterises `favicon-32.png` and `apple-touch-icon.png` with a local headless Chromium.
  `marks.test.ts` fails if any of those files drift from `marks.ts`. To change the brand: edit
  `ACTIVE_BRAND`, run both scripts, commit. `index.html` sets `theme-color` `#0b0b12`.
- **Brand kit (`/brand`, `pages/BrandPage.tsx`)**: a ten-page guideline deck laid out like a
  printed brand book. Option and colourway live in the URL (`?option=strip&colour=lagoon`) so
  a combination can be shared; "Try it in the app" sets the preview above. Pages: cover,
  identity, forms, colourways, logo use, typography, colour tokens with copy, treatment,
  mockups, downloads (the copy buttons build the SVG for the selected colourway on the fly).
- **Type.** Inter is self-hosted as a variable font (`public/fonts/inter/`, latin subset,
  SIL OFL, preloaded from `index.html`, precached by Workbox); `theme.css` declares the
  `@font-face` and `system-ui` stands in until it loads.

## Errors, offline and retry

Two layers of error UI, both rendered with the glass `ErrorCard`:

1. **In-layout `ErrorBoundary`** (`AppLayout.tsx`) wraps the `<Outlet/>`. It keeps the Navbar
   visible, offers **Try again**, and resets itself when `location.pathname` changes, so
   navigating away recovers.
2. **`RouteError`** is the router `errorElement` for the layout route and the last resort. It
   handles route error responses (404 and others) and reloads the page on retry, which also
   recovers from failed lazy-chunk imports after a deploy.

`OfflineBanner` (driven by `useOnlineStatus`, a `useSyncExternalStore` over `online`/`offline`
events) shows a glass banner while offline. Its polite live region stays mounted, so both
going offline and coming back are announced.

`services/retry.ts` provides `withRetry(task, opts)` and `fetchWithRetry(input, init, opts)`.
They use deterministic exponential backoff (300ms base, doubling, capped at 5s, 3 attempts)
and are abortable through `AbortSignal`. Only transient failures are retried: network
`TypeError`s, HTTP 5xx and 429. Other 4xx responses, `NotConfiguredError` and aborts fail
fast. A non-ok final response throws `HttpError` with its `status`. Live adapters must use
`fetchWithRetry` instead of bare `fetch`. Mocks never touch it.

## SEO: `useMeta`

`useMeta({ title?, description?, image?, type?, noindex? })` (`hooks/useMeta.ts`) is called once at the
top of each page. It sets `document.title` to `"<title> · Last Frame"` and upserts
`description`, OpenGraph and Twitter meta tags through DOM APIs (no `innerHTML`). On unmount
or input change it restores the previous values. `data:` images, such as mock posters, fall
back to the brand icon because crawlers can't use them. `index.html` carries the default tags
for non-JS crawlers. The hook also upserts `<link rel="canonical">` (absolute URL, query and hash
stripped), and `noindex: true` adds `<meta name="robots" content="noindex">` (used by
`NotFoundPage` and TitlePage's "Title not found" state). `public/robots.txt` and `public/sitemap.xml` cover the static routes. Run
`SITE_ORIGIN=https://… node scripts/generate-sitemap.mjs` after adding a static route.

## Accessibility hooks

Details and the contrast numbers are in [A11Y.md](A11Y.md). In short:

- `useRovingFocus(count, opts)` makes a list one tab stop with arrow/Home/End navigation. Rows
  of `MovieCard`s use it.
- `useFocusTrap(ref, active, { onEscape, initialFocus, restoreFocus })` traps `Tab` inside a
  dialog, closes on `Esc` and returns focus to the opener. (`TrailerModal`, the only modal since
  `DetailModal` was removed, has an equivalent built-in trap.)
- `MovieCard` takes `rovingProps` from `Row` and spreads them on its title link.
- `AppLayout` renders a **Skip to content** link that focuses `#main` (`tabIndex=-1`), plus
  ARIA landmarks. `a11y.css` holds the skip link and focus-visible styles.

- `.sr-only` (in `a11y.css`) hides content visually while keeping it available to screen
  readers.

**SPA navigation a11y.** `RouteAnnouncer` (`components/a11y/`, mounted in `AppLayout` next
to `OfflineBanner`) reacts to `pathname` changes only, skipping the initial render. After a
route change it moves focus to `#main` and announces "Navigated to <title>" in a visually
hidden polite live region. If the lazily loaded page hasn't set `document.title` yet, a
`MutationObserver` on `<head>` waits for the new title, capped at 1.5s (`TITLE_WAIT_MS`),
then announces anyway. While an `[aria-modal="true"]` dialog is open it still announces but
doesn't move focus.

**Mobile nav.** At <=760px `theme.css` hides `.nav-links`, and `Navbar` shows a menu toggle
(`aria-expanded`, `aria-controls` pointing at the links list). Opening it shows the same list
as a glass dropdown under the navbar (`nav.css`, 44px tap targets, reduced-motion safe). It
closes on Escape or an outside click, returning focus to the toggle, and on any route change.
At 480px and below only the logo mark is shown so everything fits on one line at 375px.

Use these for any new modal, menu or card rail rather than hand-rolling focus logic.

## Deployment

Netlify builds with `npm run build` and publishes `dist/`. `netlify.toml` adds the SPA
fallback, an `/api/*` → `/.netlify/functions/*` rewrite and strict security headers (CSP,
HSTS, `X-Frame-Options: DENY`). When a live integration adds a new origin, extend the CSP in
the same change. CI (`.github/workflows/ci.yml`, Node 20) runs lint, typecheck, test and build
on every push.
