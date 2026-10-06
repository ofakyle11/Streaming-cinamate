# Security controls

What protects Lastframe.tv, where each control lives, and what has to be switched on by hand.
Every control here works in mock mode with no environment variables.

## Summary

| Control                                                              | Where                                              | On by default                       |
| -------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| Content-Security-Policy                                              | `scripts/security-headers.mjs` → `dist/_headers`   | Yes                                 |
| Static security headers (HSTS, frame, referrer, permissions)         | `netlify.toml`                                     | Yes                                 |
| Rate limit on `/api/*` (60 a minute per IP, then 429)                | `netlify.toml`                                     | Yes                                 |
| Bot check on sign-in (Cloudflare Turnstile)                          | `src/components/auth/Turnstile.tsx`                | Only with `VITE_TURNSTILE_SITE_KEY` |
| Callback hardening (tokens out of the URL, same-origin return paths) | `src/auth/callback.ts`, `src/auth/callbackBoot.ts` | Yes                                 |
| Client may only read `VITE_*` variables                              | `src/test/envNames.test.ts`                        | Yes (test)                          |
| Dependency audit (production deps, high and above fail)              | `.github/workflows/ci.yml` job `audit`             | Yes                                 |
| Secret scan of history and tree (gitleaks)                           | `.github/workflows/ci.yml` job `secrets`           | Yes                                 |
| Disclosure contact                                                   | `public/.well-known/security.txt`                  | Yes                                 |

## Content-Security-Policy

The policy is built by `buildCsp()` in `scripts/security-headers.mjs`, which `npm run build`
runs after `vite build` to write `dist/_headers`. Netlify applies that file together with the
`[[headers]]` in `netlify.toml`. The CSP is not in `netlify.toml` because one entry is
conditional: `https://challenges.cloudflare.com` is added to `script-src` and `frame-src`
only when the build has a Turnstile site key. `src/test/csp.test.ts` checks both variants.

Deploy `dist/` produced by `npm run build`. A bare `vite build` has no `_headers` and would
ship without a CSP.

## Rate limit

The `/api/*` rewrite to Netlify Functions carries a `[redirects.rate_limit]` table: more than
60 requests in 60 seconds from one IP to one domain get HTTP 429. This keeps the TMDB proxy
from being used as a free API key. Netlify allows a few code-based rules per site (2 on Free,
5 on Pro); this uses one. Enforcement can lag by up to about 10 seconds.

## Turnstile

`<Turnstile onToken={...} />` renders nothing when no site key is configured. With a key it
loads `https://challenges.cloudflare.com/turnstile/v0/api.js` once, renders an
interaction-only widget (invisible for most people) and reports the token, or `null` on
expiry or error. Pass the token with the request:

```ts
await signInWithMagicLink(email, { captchaToken: token ?? undefined });
```

Supabase verifies the token with the Turnstile secret key. Setup is in
[KEYS.md](KEYS.md#vite_turnstile_site_key-client-optional).

## Auth callback

`src/auth/callbackBoot.ts` is the first import in `src/main.tsx`. On `/auth/callback` it
copies the auth parameters (`code`, `access_token`, `refresh_token`, `token_hash`, `type`,
`error*`) out of the query and fragment into memory and replaces the URL in history, before
analytics, the service worker or the Supabase client load. The callback page then calls:

```ts
const cb = readAuthCallback();
try {
  const user = await auth.completeSignIn(cb?.params ?? {});
  navigate(cb?.returnTo ?? '/', { replace: true });
} finally {
  clearAuthCallback();
}
```

`returnTo` comes from `returnTo`, `redirect`, `next` or `from` in the query and is passed
through `safeReturnPath()`: only a same-origin absolute path is kept (no `//host`, no scheme,
no backslashes or control characters, never `/auth/callback` itself), otherwise `/`.
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
