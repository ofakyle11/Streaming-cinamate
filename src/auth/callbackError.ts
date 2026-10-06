import type { SignInError } from '../pages/SignInPage';

/**
 * Supabase reports a failed link in the URL, as `#error=...&error_code=...`
 * (implicit flow) or `?error=...` (PKCE). Returns the kind we show, or null.
 */
export function readCallbackError(search: string, hash: string): SignInError | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const query = new URLSearchParams(search);
  const error = params.get('error') ?? query.get('error');
  if (!error) return null;
  const code = (params.get('error_code') ?? query.get('error_code') ?? '').toLowerCase();
  const description = (
    params.get('error_description') ??
    query.get('error_description') ??
    ''
  ).toLowerCase();
  return code === 'otp_expired' || description.includes('expired') ? 'expired' : 'link';
}
