# Security controls

What protects Lastframe.tv, where each control lives, and what has to be switched on by hand.
Every control here works in mock mode with no environment variables.

## Summary

| Control                                                              | Where                                                                               | On by default                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Content-Security-Policy                                              | `scripts/security-headers.mjs` (Vite plugin) → `dist/_headers`                      | Yes                                                            |
| Static security headers (HSTS, frame, referrer, permissions, COOP)   | `netlify.toml`                                                                      | Yes                                                            |
| Rate limit on the TMDB proxy (60 a minute per IP, then 429)          | `netlify.toml` (`/api/*` edge rule) + `netlify/functions/tmdb.ts` (per-IP backstop) | Yes                                                            |
| TMDB proxy query allow-list, no redirect following                   | `netlify/functions/tmdb.ts`                                                         | Yes                                                            |
| One origin: `*.netlify.app` redirects to lastframe.tv                | `netlify.toml`                                                                      | Yes                                                            |
| Per-user row quotas, narrowed table grants, sign-up metadata scrub   | `supabase/migrations/20261009000000_hardening.sql`                                  | Yes                                                            |
| Housekeeping jobs (deletion processor, device expiry) via pg_cron    | same migration; see [SUPABASE.md](SUPABASE.md)                                      | When pg_cron is enabled                                        |
| Analytics never receives search text or query strings                | `src/services/analytics/plausible.ts`, `src/pages/SearchPage.tsx`                   | Yes                                                            |
| Upstream URLs validated before use (images, provider links, avatars) | `src/services/tmdb/live.ts`, `src/services/auth/live.ts`                            | Yes                                                            |
| Code owners for the security surface                                 | `.github/CODEOWNERS`                                                                | Enforced once the branch ruleset requires code-owner review    |
| Governance (ISMS) documents                                          | `docs/isms/`                                                                        | Drafts for owner approval                                      |
| Bot check on sign-in (Cloudflare Turnstile)                          | `src/components/auth/Turnstile.tsx`                                                 | On `/sign-in` and resend when `VITE_TURNSTILE_SITE_KEY` is set |
| Callback hardening (tokens out of the URL, same-origin return paths) | `src/auth/callback.ts`, `src/auth/callbackBoot.ts`                                  | Yes                                                            |
| Client may only read `VITE_*` variables                              | `src/test/envNames.test.ts`                                                         | Yes (test)                                                     |
| Dependency audit (production deps, high and above fail)              | `.github/workflows/ci.yml` job `audit`                                              | Yes                                                            |
| Dependency and Actions updates (weekly PRs)                          | `.github/dependabot.yml`                                                            | Yes                                                            |
| GitHub Actions pinned to commit SHAs                                 | `.github/workflows/ci.yml`                                                          | Yes                                                            |
| Secret scan of history and tree (gitleaks)                           | `.github/workflows/ci.yml` job `secrets`                                            | Yes                                                            |
| Row Level Security on every table, checked in CI                     | `supabase/migrations/*.sql`, `supabase/tests/rls_check.sql`                         | Yes                                                            |
| No passwords: trigger strips them, adapters have no password path    | `supabase/migrations/20261006010000_*.sql`, `src/services/auth`                     | Yes                                                            |
| Admin allow-list by email (`public.admin_users`, `lf_is_admin()`)    | `supabase/migrations/20261007000000_admin_users.sql`                                | Yes (empty until the owner adds a row)                         |
| Disclosure contact                                                   | `public/.well-known/security.txt`                                                   | Yes                                                            |

## Content-Security-Policy

The policy is built by `buildCsp()` in `scripts/security-headers.mjs`. Its Vite plugin
(registered in `vite.config.ts`) writes `<outDir>/_headers` at the end of every production
build, reading the same env files and mode as the bundle, so the CSP always matches it. Netlify applies that file together with the
`[[headers]]` in `netlify.toml`. The CSP is not in `netlify.toml` because one entry is
conditional: `https://challenges.cloudflare.com` is added to `script-src` and `frame-src`
only when the build has a Turnstile site key. `src/test/csp.test.ts` checks both variants.

Deploy `dist/` produced by a production build (`npm run build`). CI checks that the build output carries it. Do not add a fallback CSP to
`netlify.toml`: both headers would apply and the stricter one would block Turnstile.

## Static headers

`netlify.toml` sends on every response: `Strict-Transport-Security` (one year, subdomains),
`X-Frame-Options: DENY` (with `frame-ancestors 'none'` in the CSP), `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that denies
every powerful feature the app never uses (camera, microphone, geolocation, payment, USB,
Bluetooth, serial, MIDI, sensors, screen capture, Topics and FLoC), and
`Cross-Origin-Opener-Policy: same-origin`, so a page that opens lastframe.tv in a new window
cannot keep a handle on it. Sign-in is a redirect, never a popup, so COOP costs nothing.
`Cross-Origin-Embedder-Policy` is deliberately not sent: it would break the YouTube trailer
embeds. HSTS `preload` is not set either; it is a one-way door and can be added once the domain
has run on HTTPS for a while.

## Rate limit

The `/api/*` rewrite to Netlify Functions carries a `[redirects.rate_limit]` table: more than
60 requests in 60 seconds from one IP to one domain get HTTP 429. This keeps the TMDB proxy
from being used as a free API key. Netlify allows a few code-based rules per site (2 on Free,
5 on Pro); this uses one. Enforcement can lag by up to about 10 seconds.

The app calls `/api/tmdb` so that rule applies to its own traffic. Because Netlify also
answers on the bare `/.netlify/functions/tmdb` path, which the rewrite rule does not cover,
the function keeps a per-IP counter of its own (same 60 a minute, per warm instance) and
answers 429 with `Retry-After`. It also forwards only allow-listed TMDB query parameters, so
a made-up parameter cannot turn one cached answer into unlimited upstream calls.

## Branch protection and deploys

Netlify deploys every push to `claude/modest-johnson-ugzfhg`. The repository rules that keep
that honest live in GitHub settings, not in this repo, and only the owner can set them
(**Settings → Rules → Rulesets**, target that branch): require a pull request with one
approval and code-owner review (`.github/CODEOWNERS`), require the `verify`, `e2e`, `db`,
`audit` and `secrets` checks to pass, block force pushes and deletion. Until that ruleset
exists the Council review in [AGENTS.md](AGENTS.md) is a convention, not a control.

Deploy previews build the PR's code, so the Netlify variables that hold secrets
(`TMDB_API_KEY`) are set for the Production context only, and previews from forks need
approval before they build ([KEYS.md](KEYS.md)).

## Third-party scripts

Plausible and Turnstile are loaded from their vendors' origins without Subresource Integrity:
both ship frequently changing scripts, so a pinned hash would break on their next release.
The exposure is bounded by the CSP (`script-src` names those two origins and nothing else
beyond `'self'` and YouTube) and by the Permissions-Policy that denies every powerful feature.

## Credential rotation

Rotate yearly and at once after any suspected exposure: `TMDB_API_KEY`, `RESEND_API_KEY`,
`TURNSTILE_SECRET_KEY`, every Netlify personal access token (none should exist for agent
sessions; git-based deploys need none) and the Supabase CLI access token. The log of
rotations is in `docs/isms/asset-inventory-and-classification.md`.

## Turnstile

`<Turnstile />` renders nothing when no site key is configured. With a key it loads
`https://challenges.cloudflare.com/turnstile/v0/api.js` once, renders an interaction-only
widget (invisible for most people) and reports the token, or `null` on expiry, error or
reset. `/sign-in` and the resend button on `/sign-in/sent` use it through
`src/auth/useCaptcha.ts`: the send button waits for a token, the token goes out as
`signInWithMagicLink(email, { captchaToken })`, and every attempt spends it and asks for a
fresh one (tokens are single use).

Supabase verifies the token with the Turnstile secret key. Turn CAPTCHA on in Supabase and
set the site key in the same release, never one without the other. Setup is in
[KEYS.md](KEYS.md#vite_turnstile_site_key-client-optional).

## Auth callback

Magic links and OAuth return to `/auth/callback` (`authRedirectUrl()` in
`src/services/auth/validate.ts`). `src/auth/callbackBoot.ts` is the first import in
`src/main.tsx`. On that path it copies the auth parameters (`code`, `access_token`,
`refresh_token`, `token_hash`, `type`, `error*`) out of the query and fragment into memory and
replaces the URL in history, before analytics, the service worker or the Supabase client load.
The Supabase client runs with `detectSessionInUrl: false`, so it never reads the URL itself.
`AuthCallbackPage` then reads the captured values once (`readAuthCallback()`), passes them to
`completeSignIn()` from `useAuth()` (which marks the user signed in), sends a rejected or
errored link back to `/sign-in`, and clears them from memory (`clearAuthCallback()`).

Where to go next is the path `/sign-in` remembered (`src/auth/returnTo.ts`), validated as a
same-origin absolute path. `safeReturnPath()` applies the same rule to any `returnTo`,
`redirect`, `next` or `from` on the callback URL itself, which is stripped along with the
tokens.
`completeSignIn()` maps provider errors to fixed copy and never echoes the provider's text.

## Sign-in has no password

Email link is the only way in. The `lf_strip_password` trigger on `auth.users` empties
`encrypted_password` on every write, so the sign-in-with-password endpoints Supabase still
exposes can never produce a usable account, and the client adapters (`src/services/auth/`)
have no password method at all, so no UI change can reintroduce one by accident. New
addresses must confirm by email and a change of address is confirmed from both mailboxes
(`supabase/config.toml`).

## Admin accounts

There are no admin passwords. An admin is an ordinary email-link account whose address is in
`public.admin_users`; `public.lf_is_admin()` (security definer, reads the JWT's `email` claim)
is the one answer future admin features (RLS policies, RPCs, an admin page) must use. Only the
owner adds rows, from the Supabase SQL editor; there is no client write path, and a signed-in
user can read only their own row. The RLS check proves a listed user is an admin, an unlisted
user is not, `anon` cannot even call the function, and no client can add, edit or remove an
admin. The list trusts the email on the sign-in token, which is safe because every address is
confirmed by email at sign-in and a change of address is confirmed from both mailboxes; a new
sign-in provider must verify emails before it is switched on, or someone could claim an
admin's address. Steps are in [SUPABASE.md](SUPABASE.md#admins).

## Dependency audit

CI fails when a production dependency has a high or critical advisory
(`npm audit --omit=dev --audit-level=high`). The full tree is audited too and reported as a
warning. The whole tree is clean after the Vite 7 / Vitest 4 upgrade; Dependabot
(`.github/dependabot.yml`) opens weekly grouped PRs for npm packages and for the GitHub
Actions, which are pinned to commit SHAs in `ci.yml` so a moved tag cannot change what runs
in CI.

## Secret scan

CI downloads a pinned, checksum-verified gitleaks and scans the whole git history and the
checked-out tree with redacted output. If it fires: rotate the credential first, then remove
it from the code. Rewriting history does not un-leak a pushed secret.

## Reporting a problem

`/.well-known/security.txt` (RFC 9116) names `security@lastframe.tv` and links the
`/security` page. Renew its `Expires` date before October 2027.
