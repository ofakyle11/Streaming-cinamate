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
  pages/              Route components (Home, Search, Genre, Title, MyList, Profiles, Account, Plans, NotFound)
  components/         Feature components (Hero, Row, MovieCard, DetailModal, Navbar)
    a11y/             RouteAnnouncer (route-change announcement + focus reset)
    brand/            LogoMark (LF glass monogram, SVG paths, token colours)
    errors/           ErrorBoundary, RouteError, ErrorCard, OfflineBanner
    ui/               Primitives: Button, IconButton, Skeleton, Toast (barrel: ui/index.ts)
  state/store.ts      Zustand store: profiles, watchlist, history, ratings slices
  hooks/              Thin hooks over the store (useProfiles, useWatchlist, useHistory, useRatings)
                      + useMeta, useFocusTrap, useRovingFocus, useOnlineStatus
  services/
    index.ts          Service locator: live vs mock per env; TMDB -> UI mapping (toMovie, loadHomeCatalog)
    types.ts          Service interfaces + domain types
    tmdb|auth|db/     mock.ts + live.ts adapters
    billing|analytics/ mock.ts only on the client (no Stripe SDK or keys, ever)
    retry.ts          withRetry / fetchWithRetry (exponential backoff) for live adapters
  data/movies.ts      Static catalogue helpers
  styles/
    tokens.css        Design tokens (color, radius, blur, motion)
    primitives.css    Styles for ui/ primitives
    theme.css         Imports tokens + primitives; app styles; prefers-reduced-motion overrides
    brand.css         LogoMark styles (imported by LogoMark.tsx)
    errors.css        Error card + offline banner (imported by errors/ components)
    a11y.css          Skip link, focus rings, main target, .sr-only (imported by AppLayout.tsx)
    nav.css           Mobile primary nav toggle + glass dropdown (imported by Navbar.tsx)
  test/               Vitest setup and integration tests
netlify/functions/    Serverless functions (health.ts); served at /api/* via netlify.toml
public/               favicon.svg, favicon-32.png, mask-icon.svg, apple-touch-icon.png,
                      icons/icon.svg, robots.txt, sitemap.xml
scripts/              generate-icons.mjs, generate-sitemap.mjs, tasks.json (task board)
docs/                 AGENTS.md (team rules + task log), ARCHITECTURE.md (this file),
                      KEYS.md (env vars), A11Y.md (accessibility)
```

## Data flow

Page/component -> hook -> zustand store (user state), or -> `services` (catalogue/auth/db).
`services.mode` reports which adapters are live.

## Environment

| Var                                            | Effect                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| `VITE_TMDB_PROXY`                              | Live TMDB through our proxy                               |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Live auth + db                                            |
| `VITE_PLAUSIBLE_DOMAIN`                        | Plausible analytics (adapter pending, `w3-analytics`)     |
| `TMDB_API_KEY` (server-only)                   | Used by the Netlify TMDB proxy function, never the client |

None are required; with none set the app is fully mocked. Full details, where to get each
value and how to set it in Netlify: [KEYS.md](KEYS.md).

## Checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must all pass.

## Styling conventions

Feature styles live in their own file under `src/styles/` and are imported by the component
that needs them (`brand.css`, `errors.css`, `a11y.css`, `nav.css`), which keeps `theme.css` small. Use
the tokens in `tokens.css`, not literal colours. Glass surfaces use the `.glass` class with
translucent backgrounds and `backdrop-filter` blur. The global `prefers-reduced-motion` block
in `theme.css` switches off animations and transitions everywhere, so new motion only needs
extra handling if it's driven by JS (for example, the hero rotation).

## Brand

- `components/brand/LogoMark.tsx`: the glossy "LF" monogram. Its glyphs are SVG paths, so it
  doesn't depend on a loaded font. Gradient ids come from `useId()` so several marks can share a
  page. Pass `decorative` when a visible wordmark sits beside it (as in the Navbar), otherwise
  it exposes `title` as its accessible name.
- Static icons in `public/` mirror the mark: `favicon.svg`, `mask-icon.svg` and
  `icons/icon.svg` (full bleed). `node scripts/generate-icons.mjs` rasterises
  `favicon-32.png` and `apple-touch-icon.png` with a local headless Chromium. `index.html`
  sets `theme-color` `#0b0b12`.

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
  of `MovieCard`s use it, and items must forward refs.
- `useFocusTrap(ref, active, { onEscape, initialFocus, restoreFocus })` traps `Tab` inside
  dialogs (`DetailModal`), closes on `Esc` and returns focus to the opener.
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
