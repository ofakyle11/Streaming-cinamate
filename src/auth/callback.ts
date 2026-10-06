/**
 * Hardening for the /auth/callback route (magic link return).
 *
 * Order matters: call `captureAuthCallback()` before anything else runs on the
 * page. It copies the auth parameters out of the URL into memory and replaces
 * the URL in history so tokens never sit in the address bar, browser history,
 * referrers or analytics. Hand the captured values to the auth adapter; the
 * Supabase client must not rely on detectSessionInUrl once the URL is clean.
 */

/** Query/hash keys Supabase (and OAuth generally) put in the callback URL. */
export const AUTH_PARAM_KEYS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'provider_token',
  'provider_refresh_token',
  'token_type',
  'type',
  'code',
  'token',
  'token_hash',
  'error',
  'error_code',
  'error_description',
] as const;

export type AuthParamKey = (typeof AUTH_PARAM_KEYS)[number];

/** Keys that are credentials: never log, never keep around longer than needed. */
export const SECRET_PARAM_KEYS: readonly AuthParamKey[] = [
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'code',
  'token',
  'token_hash',
];

export interface AuthCallback {
  /** Auth parameters found in the query string or hash fragment. */
  params: Partial<Record<AuthParamKey, string>>;
  /** Same-origin path to continue to afterwards (defaults to `/`). */
  returnTo: string;
  /** True when the URL carried any auth parameter. */
  hadParams: boolean;
}

/** Fallback when a return path is missing or unsafe. */
export const DEFAULT_RETURN_PATH = '/';

/**
 * Returns `raw` only if it is a same-origin absolute path (`/account?tab=x`),
 * otherwise the default. Rejects protocol-relative URLs (`//evil.com`),
 * schemes (`https:`, `javascript:`), backslashes, control characters and
 * anything that does not start with a single `/`. A full URL on the current
 * origin is reduced to its path.
 */
export function safeReturnPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_RETURN_PATH,
): string {
  if (typeof raw !== 'string') return fallback;
  let value = raw.trim();
  if (!value) return fallback;
  // Allow an absolute URL that is really ours (e.g. a link built from window.location).
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    if (typeof window === 'undefined' || !window.location?.origin) return fallback;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return fallback;
    }
    if (url.origin !== window.location.origin) return fallback;
    value = `${url.pathname}${url.search}${url.hash}`;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // Never bounce back into the callback itself.
  if (/^\/auth\/callback(?:[/?#]|$)/.test(value)) return fallback;
  return value;
}

function pick(from: URLSearchParams, into: Partial<Record<AuthParamKey, string>>): boolean {
  let found = false;
  for (const key of AUTH_PARAM_KEYS) {
    const v = from.get(key);
    if (v !== null && v !== '') {
      into[key] = v;
      found = true;
    }
  }
  return found;
}

/**
 * Reads the auth parameters from `location` (query and `#fragment`), strips
 * them from the URL with history.replaceState, and returns them along with a
 * validated same-origin return path (`returnTo`, `redirect`, `next` or `from`
 * in the query). Safe to call more than once: the second call finds nothing.
 */
export function captureAuthCallback(
  loc: Location = window.location,
  hist: History = window.history,
): AuthCallback {
  const params: Partial<Record<AuthParamKey, string>> = {};
  const query = new URLSearchParams(loc.search);
  const hash = new URLSearchParams(loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash);
  const fromQuery = pick(query, params);
  const fromHash = pick(hash, params);

  const rawReturn =
    query.get('returnTo') ?? query.get('redirect') ?? query.get('next') ?? query.get('from');
  const returnTo = safeReturnPath(rawReturn);

  if (fromQuery || fromHash || rawReturn !== null) {
    for (const key of AUTH_PARAM_KEYS) query.delete(key);
    for (const key of ['returnTo', 'redirect', 'next', 'from']) query.delete(key);
    const search = query.toString();
    const clean = `${loc.pathname}${search ? `?${search}` : ''}`;
    try {
      hist.replaceState(hist.state, '', clean);
    } catch {
      /* history unavailable: the page still gets the params */
    }
  }
  return { params, returnTo, hadParams: fromQuery || fromHash };
}
