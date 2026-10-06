# Keys and environment variables

**No variable is required.** With none set, every service runs on its mock adapter and the
app is fully usable. Set a variable only to switch one integration to live.

## The two kinds of variable

| Kind            | Prefix     | Where it ends up                                                      | Safe for secrets? |
| --------------- | ---------- | --------------------------------------------------------------------- | ----------------- |
| **Client**      | `VITE_`    | Inlined into the JavaScript bundle at build time. Anyone can read it. | **No**            |
| **Server-only** | no `VITE_` | Available only to Netlify Functions at runtime (`process.env`).       | Yes               |

Vite only exposes variables that start with `VITE_` to `import.meta.env`. Never give a secret
a `VITE_` prefix, and never read a server-only variable from `src/`.

## Summary

| Variable                  | Kind        | Used by                                  | Enables                                |
| ------------------------- | ----------- | ---------------------------------------- | -------------------------------------- |
| `VITE_TMDB_PROXY`         | Client      | `src/services/index.ts` → `tmdb/live.ts` | Live TMDB catalogue via proxy          |
| `TMDB_API_KEY`            | Server-only | Netlify TMDB proxy function              | Proxy calls to TMDB                    |
| `VITE_SUPABASE_URL`       | Client      | `src/services/index.ts` → `auth`, `db`   | Live Supabase auth + database          |
| `VITE_SUPABASE_ANON_KEY`  | Client      | `src/services/index.ts` → `auth`, `db`   | (paired with the URL)                  |
| `VITE_AUTH_GOOGLE`        | Client      | `src/auth/flags.ts` → `/sign-in`         | Shows the Google button                |
| `VITE_PLAUSIBLE_DOMAIN`   | Client      | Analytics adapter (Plausible)            | Privacy-friendly page views            |
| `VITE_PLAUSIBLE_API_HOST` | Client      | Analytics adapter (Plausible)            | Optional custom/proxied Plausible host |

Variables used only when pushing `supabase/config.toml` to the project (never in Netlify, never
in `src/`): `RESEND_API_KEY` (SMTP password for Resend), `TURNSTILE_SECRET_KEY` (only once the
bot check is on), `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (only once Google is
on). `config.toml` references them as `env(NAME)`, so the file holds no secret; a test guards that.

Build-time and script-only variables that do not configure the app are listed at the end.

## Details

### `VITE_TMDB_PROXY` (client)

- **What**: base URL of **our** TMDB proxy, for example `/api/tmdb` (same origin, through the
  `/api/*` rewrite in `netlify.toml`) or `https://<site>.netlify.app/api/tmdb`.
- **Why it's safe**: it's just a URL. The browser never talks to TMDB with a key. Requests go
  to the proxy, and the proxy adds the key server-side.
- **Where to get it**: it's your own deployment's URL, so there's nothing to sign up for.
- **Effect**: when set, `services.tmdb` uses `createLiveTmdb(proxy)`. Otherwise it uses the
  mock catalogue. Poster and backdrop images load from `https://image.tmdb.org` in both modes
  (already allowed by the CSP).

### `TMDB_API_KEY` (server-only)

- **What**: TMDB API credential used by the Netlify TMDB proxy function. Use the **API Read
  Access Token** (v4 bearer) or the v3 API key, whichever the proxy implementation expects.
- **Where to get it**: create a free account at <https://www.themoviedb.org/signup>, then go to
  **Settings → API** (<https://www.themoviedb.org/settings/api>) and request a developer key.
- **Never** prefix it with `VITE_` and never reference it under `src/`. It belongs only in
  `netlify/functions/`.
- **Status**: live. The proxy is `netlify/functions/tmdb.ts` (contract below, under
  **TMDB proxy**) and `tmdb/live.ts` calls it. Scope the key to **Functions** only.

### `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (client)

- **What**: your Supabase project URL (`https://<ref>.supabase.co`) and its **anon** (public)
  key.
- **Why the anon key is OK in the client**: Supabase designs it to be public. Access control
  comes from **Row Level Security**, so every table must have RLS enabled with policies
  (project rule: no SQL without RLS). **Never** put the `service_role` key in any `VITE_`
  variable or anywhere in `src/`.
- **Where to get them**: create a project at <https://supabase.com/dashboard>, then go to
  **Project Settings → API**. Copy **Project URL** and the **anon public** key.
- **Effect**: live mode is chosen when `VITE_SUPABASE_URL` is set, and the anon key is passed
  alongside it, so always set both. Auth errors with `NotConfiguredError` if either is missing,
  and db methods without backing tables still reject with `NotConfiguredError`.
- **CSP**: when going live, add `https://<ref>.supabase.co` (and `wss://<ref>.supabase.co` for
  realtime) to `connect-src` in `netlify.toml`.
- **Redirect URLs, Site URL, link expiry, email template, SMTP**: all declared in
  `supabase/config.toml` and applied with `npx supabase config push` (the sign-in link lands on
  `/auth/callback`, which returns the user to the page they came from). The full switch-on
  runbook, including the Netlify scopes and the Resend DNS records, is `docs/SUPABASE.md`.
- **Scope**: **Builds**, **Production** context only, so deploy previews stay in mock mode.

### `VITE_AUTH_GOOGLE` (client)

- **What**: `1` (or `true` / `on`) renders the "Continue with Google" button on `/sign-in`.
  Anything else, or unset, hides it. Not a secret.
- **Why a flag**: email link is the only sign-in method at launch. The Google code path stays
  in the app so it can be switched on per deploy once a Google OAuth client is configured in
  Supabase (**Authentication → Providers → Google**) and the privacy and terms pages exist.
- **Effect**: UI only; the live adapter's `signInWithOAuth` works regardless, and the mock
  adapter signs a demo user in.

### `VITE_PLAUSIBLE_DOMAIN` (client)

- **What**: the site domain registered in Plausible, for example `lastframe.tv`. It's not a
  secret.
- **Where to get it**: add your site at <https://plausible.io/sites> (or your self-hosted
  Plausible) and use the domain exactly as entered there.
- **Effect**: enables the Plausible analytics adapter. When unset, analytics use the
  console/no-op mock (`src/services/analytics/mock.ts`), which logs only in dev builds.
- **Status**: live. See **Analytics** below for events and CSP notes.

### `VITE_PLAUSIBLE_API_HOST` (client, optional)

- **What**: a self-hosted or proxied Plausible host (default `https://plausible.io`). Only used
  when `VITE_PLAUSIBLE_DOMAIN` is set. A different origin must also be added to the CSP.

## Billing: no keys

Billing is **mock-only** (`src/services/billing/mock.ts`). There is no Stripe SDK, no Stripe
publishable or secret key, and no payment variable of any kind. Don't add one. Plan changes
are simulated locally.

## Setting variables in Netlify

1. Open the site in the Netlify UI, then go to **Site configuration → Environment variables**
   (under **Project configuration** in newer UIs).
2. Choose **Add a variable → Add a single variable**, then enter the key and value.
3. **Scopes**:
   - `VITE_*` variables must include the **Builds** scope, because Vite inlines them during
     `npm run build`.
   - `TMDB_API_KEY` needs only the **Functions** scope. Mark it **Contains secret values** so
     Netlify hides it in the UI and logs.
4. Optionally set different values per **deploy context** (Production, Deploy Previews,
   Branch deploys). Leaving previews unset keeps them in mock mode.
5. Trigger a new deploy (**Deploys → Trigger deploy → Deploy site**). Client values are
   frozen into the bundle, so changes take effect only after a rebuild.

For local development, put client variables in `.env.local` (never commit it). To run
functions locally with server-only variables, use `netlify dev`, which reads the site's
environment variables or a local `.env`.

## Rules

- Client code may only read public `VITE_*` config. Anything prefixed `VITE_` is baked into the bundle and is **public**.
- Server secrets live only in Netlify environment variables and are read via `process.env` inside `netlify/functions/*`.
- Never commit keys, never log them, never return them in a response.
- No Stripe SDK or Stripe keys anywhere.

## Analytics

- **Mock by default.** With no env set, `src/services/analytics/mock.ts` is used: events are kept in memory and logged to the console in dev. Nothing leaves the browser.
- **Plausible** (`src/services/analytics/plausible.ts`) is picked by `src/services/index.ts` only when `VITE_PLAUSIBLE_DOMAIN` is set. It injects `<host>/js/script.manual.js` and sends page views on route change.
- `identify()` is a deliberate no-op in the Plausible adapter: Plausible is cookieless and anonymous, so user ids and traits are never sent.
- Event names (see `AnalyticsEvents` in `src/services/analytics/types.ts`; keep them stable, goals key off them): `search`, `add-to-list`, `play-trailer`, `title-open`. Page views are sent as `pageview`.
- `title-open` fires when a title card is selected. Props: `id` (TMDB id), `mediaType` (`movie` | `tv`), `source` (`home` | `search` | `genre` | `new`); Genre also adds `genreId`, `page`, `sortBy`. Always emit it through the typed `track(AnalyticsEvents.titleOpen, ...)` helper in `src/services/analytics/track.ts`; `src/test/analyticsCallSites.test.ts` fails if a page or component calls `analytics.track('...')` directly or uses the legacy `title_open` name.
- **CSP.** `netlify.toml` allows `https://plausible.io` in `script-src` and `connect-src` (a test in `src/test/csp.test.ts` keeps this in sync with `DEFAULT_PLAUSIBLE_HOST`). If you set a custom `VITE_PLAUSIBLE_API_HOST` on another origin, add that origin to both directives too, or the browser will block the script and the `/api/event` beacons. Alternatively proxy Plausible same-origin through a `netlify.toml` redirect under `/api` (e.g. `/api/plausible/*`, placed before the `/api/*` functions redirect) and point `VITE_PLAUSIBLE_API_HOST` at your own site; same-origin requests are covered by `'self'` and need no CSP change.

## TMDB proxy (`netlify/functions/tmdb.ts`)

Reachable at `/.netlify/functions/tmdb` or `/api/tmdb` (see `netlify.toml` redirect).

```
GET /api/tmdb?path=movie/popular&page=2&language=en-US
```

- `path` is a relative TMDB v3 path. It must match the allowlist (`ALLOWED_PATHS`): trending, movie/tv lists, discover, search, genre lists, movie/tv/person details and their sub-resources, configuration. Others return `403`.
- Absolute URLs, `//`, `..`, `:`, `\`, `%`, `?`, `#`, `@` in `path` are rejected with `400`.
- All other query params are forwarded, except client-supplied `api_key` / `access_token` (any case), which are stripped.
- The key is attached server-side: v4 tokens (`eyJ...`) as `Authorization: Bearer`, v3 keys as the `api_key` param.
- Successful responses are cached in memory for 10 minutes per warm instance (key = path + sorted query) and sent with `Cache-Control: public, max-age=600, s-maxage=600` plus `X-Cache: HIT|MISS`. Errors are `no-store` and never cached.
- Upstream error bodies are never forwarded (they could reference the key).

Error shape (always JSON):

```json
{
  "error": {
    "code": "not_configured",
    "message": "TMDB proxy is not configured (TMDB_API_KEY missing)."
  }
}
```

| Status | code                                                              |
| ------ | ----------------------------------------------------------------- |
| 400    | `missing_path`, `invalid_path`, `invalid_query`                   |
| 403    | `path_not_allowed`                                                |
| 404    | `not_found` (TMDB 404)                                            |
| 405    | `method_not_allowed`                                              |
| 429    | `rate_limited` (TMDB 429)                                         |
| 502    | `upstream_error`, `upstream_unreachable`, `upstream_bad_response` |
| 503    | `not_configured` (`TMDB_API_KEY` unset)                           |
| 504    | `upstream_timeout`                                                |

## Setting keys (quick reference)

- Local: `netlify env:set TMDB_API_KEY <key>` or a git-ignored `.env` used by `netlify dev`.
- Production: Netlify UI, Site configuration, Environment variables. Scope `TMDB_API_KEY` to Functions only.
- Rotate by replacing the value and redeploying; the cache is per-instance and expires within 10 minutes.

## Other variables (tooling only)

These don't affect the app bundle and are never needed in Netlify:

| Variable                   | Used by                        | Purpose                                                             |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `SITE_ORIGIN`              | `scripts/generate-sitemap.mjs` | Origin written into `sitemap.xml` (default `https://lastframe.tv`). |
| `CHROME_BIN`               | `scripts/generate-icons.mjs`   | Path to a Chromium binary for rasterising icons.                    |
| `PLAYWRIGHT_BROWSERS_PATH` | `scripts/generate-icons.mjs`   | Fallback location to search for Chromium.                           |

Vite's built-ins (`import.meta.env.DEV`, `MODE`) are used by `ErrorBoundary.tsx` and
`analytics/mock.ts` to gate dev-only logging. You don't set them.

## Keeping this file complete

When you add a variable, list it here. To audit:

```bash
grep -rn "import.meta.env\|process.env" src netlify scripts
```
