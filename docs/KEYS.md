# Keys and secrets

Never commit keys. Every external service has a mock adapter, so the app runs with no env vars.

## TMDB (`TMDB_API_KEY`)

- Server-only. Set it in Netlify site settings (Environment variables), or in a git-ignored `.env` for `netlify dev`.
- Never prefix it with `VITE_`; that would bundle it into client code.
- Used only by `netlify/functions/tmdb.ts`, which proxies
  `/.netlify/functions/tmdb?path=<tmdb path>&<query>` to `https://api.themoviedb.org/3`.
  - Only allowlisted read-only paths (trending, lists, details, credits, search, discover, genres, providers) are forwarded; others get 403.
  - Responses are cached in memory for 10 minutes and sent with `Cache-Control: public, max-age=...` (`X-Cache: HIT|MISS`).
  - Errors are JSON: `{ "error": { "code": "...", "message": "..." } }`. Without the key it returns 503 `not_configured`; the client should fall back to the mock adapter.
  - Any client-supplied `api_key` param is stripped; the key never appears in responses.
