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

| Variable                 | Kind        | Used by                                  | Enables                       |
| ------------------------ | ----------- | ---------------------------------------- | ----------------------------- |
| `VITE_TMDB_PROXY`        | Client      | `src/services/index.ts` → `tmdb/live.ts` | Live TMDB catalogue via proxy |
| `TMDB_API_KEY`           | Server-only | Netlify TMDB proxy function              | Proxy calls to TMDB           |
| `VITE_SUPABASE_URL`      | Client      | `src/services/index.ts` → `auth`, `db`   | Live Supabase auth + database |
| `VITE_SUPABASE_ANON_KEY` | Client      | `src/services/index.ts` → `auth`, `db`   | (paired with the URL)         |
| `VITE_PLAUSIBLE_DOMAIN`  | Client      | Analytics adapter (Plausible)            | Privacy-friendly page views   |

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
- **Status**: the proxy function and the live TMDB adapter's endpoints are being built by
  another stream. `netlify/functions/` currently only contains `health.ts`, and
  `tmdb/live.ts` throws `NotConfiguredError` until the proxy contract lands. Setting
  `VITE_TMDB_PROXY` before then makes catalogue calls fail, so leave it unset.

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
  alongside it, so always set both. The live auth/db adapters are stubs today (they throw
  `NotConfiguredError`), so keep them unset until the Supabase client is wired in.
- **CSP**: when going live, add `https://<ref>.supabase.co` (and `wss://<ref>.supabase.co` for
  realtime) to `connect-src` in `netlify.toml`.

### `VITE_PLAUSIBLE_DOMAIN` (client)

- **What**: the site domain registered in Plausible, for example `lastframe.tv`. It's not a
  secret.
- **Where to get it**: add your site at <https://plausible.io/sites> (or your self-hosted
  Plausible) and use the domain exactly as entered there.
- **Effect**: enables the Plausible analytics adapter. When unset, analytics use the
  console/no-op mock (`src/services/analytics/mock.ts`), which logs only in dev builds.
- **Status**: the Plausible adapter is being added by the analytics task (`w3-analytics`).
  Until it lands, `services.analytics` is always the mock. When enabling it, add the Plausible
  host (for example `https://plausible.io`) to `script-src`/`connect-src` in `netlify.toml`.

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
