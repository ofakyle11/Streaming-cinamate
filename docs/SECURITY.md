# Security controls

What protects Lastframe.tv, where each control lives, and what has to be switched on by hand.
Every control here works in mock mode with no environment variables.

## Summary

| Control                                                              | Where                                                          | On by default                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Content-Security-Policy                                              | `scripts/security-headers.mjs` (Vite plugin) → `dist/_headers` | Yes                                                            |
| Static security headers (HSTS, frame, referrer, permissions)         | `netlify.toml`                                                 | Yes                                                            |
| Rate limit on `/api/*` (60 a minute per IP, then 429)                | `netlify.toml`                                                 | Yes                                                            |
| Bot check on sign-in (Cloudflare Turnstile)                          | `src/components/auth/Turnstile.tsx`                            | On `/sign-in` and resend when `VITE_TURNSTILE_SITE_KEY` is set |
| Callback hardening (tokens out of the URL, same-origin return paths) | `src/auth/callback.ts`, `src/auth/callbackBoot.ts`             | Yes                                                            |
| Client may only read `VITE_*` variables                              | `src/test/envNames.test.ts`                                    | Yes (test)                                                     |
| Dependency audit (production deps, high and above fail)              | `.github/workflows/ci.yml` job `audit`                         | Yes                                                            |
| Secret scan of history and tree (gitleaks)                           | `.github/workflows/ci.yml` job `secrets`                       | Yes                                                            |
| Disclosure contact                                                   | `public/.well-known/security.txt`                              | Yes                                                            |

## Content-Security-Policy

The policy is built by `buildCsp()` in `scripts/security-headers.mjs`. Its Vite plugin
(registered in `vite.config.ts`) writes `<outDir>/_headers` at the end of every production
build, reading the same env files and mode as the bundle, so the CSP always matches it. Netlify applies that file together with the
`[[headers]]` in `netlify.toml`. The CSP is not in `netlify.toml` because one entry is
conditional: `https://challenges.cloudflare.com` is added to `script-src` and `frame-src`
only when the build has a Turnstile site key. `src/test/csp.test.ts` checks both variants.

Deploy `dist/` produced by a production build (`npm run build`). CI checks that the build output carries it. Do not add a fallback CSP to
`netlify.toml`: both headers would apply and the stricter one would block Turnstile.

## Rate limit

The `/api/*` rewrite to Netlify Functions carries a `[redirects.rate_limit]` table: more than
60 requests in 60 seconds from one IP to one domain get HTTP 429. This keeps the TMDB proxy
from being used as a free API key. Netlify allows a few code-based rules per site (2 on Free,
5 on Pro); this uses one. Enforcement can lag by up to about 10 seconds.

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

## Dependency audit

CI fails when a production dependency has a high or critical advisory
(`npm audit --omit=dev --audit-level=high`). The full tree is audited too but only reported as
a warning: dev tooling (Vite dev server, Vitest) never ships to the browser, and clearing it
needs major upgrades that belong in their own change.

## Secret scan

CI downloads a pinned, checksum-verified gitleaks and scans the whole git history and the
checked-out tree with redacted output. If it fires: rotate the credential first, then remove
it from the code. Rewriting history does not un-leak a pushed secret.

## Reporting a problem

`/.well-known/security.txt` (RFC 9116) names `security@lastframe.tv` and links the
`/security` page. Renew its `Expires` date before October 2027.
