# Keys and secrets

Last Frame runs fully mocked with **no** env vars. Live services are opt-in.

## Rules

- Client code may only read public `VITE_*` config. Anything prefixed `VITE_` is baked into the bundle and is **public**.
- Server secrets live only in Netlify environment variables and are read via `process.env` inside `netlify/functions/*`.
- Never commit keys, never log them, never return them in a response.
- No Stripe SDK or Stripe keys anywhere.

## Variables

| Var | Where | Secret? | Purpose |
| --- | --- | --- | --- |
| `TMDB_API_KEY` | Netlify env (functions only) | Yes | TMDB v3 API key **or** v4 read access token, used by `netlify/functions/tmdb.ts` |
| `VITE_TMDB_PROXY` | Client build env | No | Base URL of the proxy, e.g. `/api/tmdb`. Setting it switches the client TMDB adapter to live |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Client build env | No (anon key is public by design; RLS protects data) | Live auth + db |
| `VITE_PLAUSIBLE_DOMAIN` | Client build env | No | Site domain as registered in Plausible, e.g. `lastframe.tv`. Setting it switches the analytics adapter to Plausible |
| `VITE_PLAUSIBLE_API_HOST` | Client build env | No | Optional self-hosted or proxied Plausible host (default `https://plausible.io`). Only used when `VITE_PLAUSIBLE_DOMAIN` is set |

## Analytics

- **Mock by default.** With no env set, `src/services/analytics/mock.ts` is used: events are kept in memory and logged to the console in dev. Nothing leaves the browser.
- **Plausible** (`src/services/analytics/plausible.ts`) is picked by `src/services/index.ts` only when `VITE_PLAUSIBLE_DOMAIN` is set. It injects `<host>/js/script.manual.js` and sends page views on route change.
- `identify()` is a deliberate no-op in the Plausible adapter: Plausible is cookieless and anonymous, so user ids and traits are never sent.
- Event names (see `AnalyticsEvents` in `src/services/analytics/types.ts`; keep them stable, goals key off them): `search`, `add-to-list`, `play-trailer`. Page views are sent as `pageview`.
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
{ "error": { "code": "not_configured", "message": "TMDB proxy is not configured (TMDB_API_KEY missing)." } }
```

| Status | code |
| --- | --- |
| 400 | `missing_path`, `invalid_path`, `invalid_query` |
| 403 | `path_not_allowed` |
| 404 | `not_found` (TMDB 404) |
| 405 | `method_not_allowed` |
| 429 | `rate_limited` (TMDB 429) |
| 502 | `upstream_error`, `upstream_unreachable`, `upstream_bad_response` |
| 503 | `not_configured` (`TMDB_API_KEY` unset) |
| 504 | `upstream_timeout` |

## Setting keys

- Local: `netlify env:set TMDB_API_KEY <key>` or a git-ignored `.env` used by `netlify dev`.
- Production: Netlify UI, Site configuration, Environment variables. Scope `TMDB_API_KEY` to Functions only.
- Rotate by replacing the value and redeploying; the cache is per-instance and expires within 10 minutes.
