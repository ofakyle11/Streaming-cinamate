/**
 * Where to send the user after sign-in.
 *
 * The sign-in page takes a `returnTo` search param; only same-origin paths are
 * accepted (a bare `/path?query#hash`), so a crafted link can never bounce a
 * freshly signed-in user to another site. The live magic link opens in
 * whatever tab the mail client picks, so the path is also kept in localStorage
 * with a short TTL for /auth/callback to read.
 */

export const RETURN_TO_KEY = 'lf.auth.returnTo';
/** A magic link lasts 15 minutes on the Supabase side; keep the path a little longer. */
export const RETURN_TO_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_RETURN_TO = '/';

/** Paths that never make sense to return to (the auth flow itself). */
const AUTH_PATHS = ['/sign-in', '/auth/callback'];

function hasControlOrSpace(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate a candidate return path. Returns the path when it is a same-origin,
 * absolute path (no scheme, no host, no protocol-relative `//`), else null.
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  // Backslashes are treated as slashes by some browsers ("/\evil.com").
  if (value.includes('\\')) return null;
  if (hasControlOrSpace(value)) return null;
  if (value.length > 2048) return null;
  const pathname = value.split(/[?#]/, 1)[0].toLowerCase();
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return value;
}

/** The path to return to from a location, falling back to the home page. */
export function resolveReturnTo(raw: string | null | undefined): string {
  return safeReturnTo(raw) ?? DEFAULT_RETURN_TO;
}

/** Build the sign-in URL that comes back to `path` afterwards. */
export function signInHref(path?: string | null): string {
  const target = safeReturnTo(path);
  return target && target !== DEFAULT_RETURN_TO
    ? `/sign-in?returnTo=${encodeURIComponent(target)}`
    : '/sign-in';
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Remember where to go after the magic link brings the user back. */
export function rememberReturnTo(
  path: string,
  storage: KeyValueStorage | null = defaultStorage(),
  now = Date.now(),
): void {
  const target = safeReturnTo(path);
  try {
    if (!target || target === DEFAULT_RETURN_TO) storage?.removeItem(RETURN_TO_KEY);
    else
      storage?.setItem(
        RETURN_TO_KEY,
        JSON.stringify({ path: target, expiresAt: now + RETURN_TO_TTL_MS }),
      );
  } catch {
    /* storage unavailable: the callback falls back to the home page */
  }
}

/** Forget the remembered path. */
export function forgetReturnTo(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(RETURN_TO_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Read the remembered path without consuming it, or null when none or expired.
 * Reading is non-destructive so a StrictMode double render or a reload during
 * the callback keeps the path; the caller forgets it once it has navigated.
 */
export function peekReturnTo(
  storage: KeyValueStorage | null = defaultStorage(),
  now = Date.now(),
): string | null {
  try {
    const raw = storage?.getItem(RETURN_TO_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { path, expiresAt } = parsed as { path?: unknown; expiresAt?: unknown };
    if (typeof expiresAt !== 'number' || expiresAt <= now) return null;
    return safeReturnTo(typeof path === 'string' ? path : null);
  } catch {
    return null;
  }
}

/** Read and forget the remembered path (one use), or null when none or expired. */
export function takeReturnTo(
  storage: KeyValueStorage | null = defaultStorage(),
  now = Date.now(),
): string | null {
  const path = peekReturnTo(storage, now);
  forgetReturnTo(storage);
  return path;
}
