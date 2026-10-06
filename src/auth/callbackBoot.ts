/**
 * Runs before any other app module (first import in main.tsx), so auth tokens
 * in a /auth/callback URL are removed from the address bar and history before
 * analytics, the service worker or the Supabase client can see them. The
 * captured values wait in memory for the callback page to take them once.
 */
import { captureAuthCallback, type AuthCallback } from './callback';

export const AUTH_CALLBACK_PATH = '/auth/callback';

let pending: AuthCallback | null = null;

export function bootAuthCallback(
  loc: Location = window.location,
  hist: History = window.history,
): void {
  if (loc.pathname.replace(/\/+$/, '') !== AUTH_CALLBACK_PATH) return;
  pending = captureAuthCallback(loc, hist);
}

/** The callback captured at boot, or null when this load was not a callback. */
export function readAuthCallback(): AuthCallback | null {
  return pending;
}

/**
 * Forget the captured tokens. Call it as soon as the exchange settles (success
 * or failure) so they never outlive it. Reading is non-destructive so React
 * StrictMode's double effects in development see the same value.
 */
export function clearAuthCallback(): void {
  pending = null;
}

if (typeof window !== 'undefined') bootAuthCallback();
