/** Fixed, user-facing sign-in copy shared by the live and mock auth adapters. */

/** Shown for expired, reused or malformed sign-in links. Never echoes provider text. */
export const LINK_INVALID_MESSAGE =
  'This sign-in link has expired or was already used. Request a new one.';

export const SIGN_IN_CANCELLED_MESSAGE = 'Sign-in was cancelled.';

/** Maps a callback error code to fixed copy; the provider's description is never shown. */
export function callbackErrorMessage(code?: string): string {
  if (code === 'access_denied') return SIGN_IN_CANCELLED_MESSAGE;
  return LINK_INVALID_MESSAGE;
}

/** changeEmail() while signed out (mock; live rejects at Supabase). */
export const SIGN_IN_TO_CHANGE_EMAIL_MESSAGE = 'Sign in to change your email address.';
