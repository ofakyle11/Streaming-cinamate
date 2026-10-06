/**
 * Sign-in feature flags. Email link is the only method at launch; the Google
 * button stays in the code behind VITE_AUTH_GOOGLE so it can be switched on
 * per deploy once the OAuth client and the legal pages exist.
 */
const ON = new Set(['1', 'true', 'on', 'yes']);

export function flagOn(value: unknown): boolean {
  return typeof value === 'string' && ON.has(value.trim().toLowerCase());
}

/** Whether the "Continue with Google" button renders. Default off. */
export function googleSignInEnabled(env: Record<string, unknown> = import.meta.env): boolean {
  return flagOn(env.VITE_AUTH_GOOGLE);
}
