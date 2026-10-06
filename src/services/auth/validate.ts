/** Shared input validation for the auth adapters (live + mock behave identically). */

// Pragmatic check: one "@", non-empty local part, a dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length <= 254 && EMAIL_RE.test(email);
}

/** Returns the normalised email or throws a user-facing error. */
export function requireEmail(raw: string): string {
  if (!isValidEmail(raw)) throw new Error('Enter a valid email address.');
  return normalizeEmail(raw);
}

export function requirePassword(password: string): void {
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
}

/** The route that finishes a magic-link / OAuth sign-in (see pages/AuthCallbackPage). */
export const AUTH_CALLBACK_PATH = '/auth/callback';

/**
 * Where auth providers send the browser back to after a magic link / OAuth.
 * Add `<origin>/auth/callback` to the Supabase project's redirect allow-list.
 */
export function authRedirectUrl(path = AUTH_CALLBACK_PATH): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;
  return `${window.location.origin}${path}`;
}
