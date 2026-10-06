import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthCard from '../components/auth/AuthCard';
import { useAuth } from '../auth';
import { DEFAULT_RETURN_TO, forgetReturnTo, peekReturnTo } from '../auth/returnTo';
import { SENT_EMAIL_KEY } from './SignInPage';
import { useMeta } from '../hooks/useMeta';
import { readCallbackError } from '../auth/callbackError';
import type { SignInError } from './SignInPage';
import { clearAuthCallback, readAuthCallback } from '../auth/callbackBoot';
import type { AuthCallback } from '../auth/callback';

/** True when the captured callback carries something the adapter can exchange. */
function hasCredentials(cb: AuthCallback | null): boolean {
  const p = cb?.params;
  return !!(p && (p.code || (p.access_token && p.refresh_token) || (p.token_hash && p.type)));
}

/**
 * The link error, from the parameters main.tsx captured (and already stripped
 * from the address bar), else from the current URL (tests, a missed capture).
 */
function initialLinkError(
  cb: AuthCallback | null,
  search: string,
  hash: string,
): SignInError | null {
  if (cb?.hadParams) {
    const captured = new URLSearchParams();
    for (const [key, value] of Object.entries(cb.params)) if (value) captured.set(key, value);
    return readCallbackError('', captured.toString());
  }
  return readCallbackError(search, hash);
}

/** How long to wait for the SDK to turn the link into a session before giving up. */
export const CALLBACK_TIMEOUT_MS = 8_000;

function signInUrl(error: SignInError, returnTo: string | null): string {
  const params = new URLSearchParams({ error });
  if (returnTo && returnTo !== DEFAULT_RETURN_TO) params.set('returnTo', returnTo);
  return `/sign-in?${params.toString()}`;
}

export interface AuthCallbackPageProps {
  /** Override the give-up timeout (tests). */
  timeoutMs?: number;
}

/**
 * /auth/callback: the magic link (or OAuth) lands here. src/auth/callbackBoot.ts
 * (first import in main.tsx) has already moved the token out of the URL; we
 * hand it to the adapter's completeSignIn, AuthProvider flips to authenticated,
 * and we continue to the remembered page. A link that failed (expired, used)
 * goes back to /sign-in with the reason; so does a link that never resolves.
 */
export default function AuthCallbackPage({
  timeoutMs = CALLBACK_TIMEOUT_MS,
}: AuthCallbackPageProps) {
  const location = useLocation();
  const { status, mode, completeSignIn } = useAuth();
  const [captured] = useState(() => readAuthCallback());
  // Read the remembered path without consuming it: StrictMode renders twice and
  // a reload mid-spinner must not lose it. It is forgotten below once we leave.
  const [returnTo] = useState(() => peekReturnTo());
  const [linkError, setLinkError] = useState(() =>
    initialLinkError(captured, location.search, location.hash),
  );
  const exchanged = useRef(false);
  // The give-up timer waits while an exchange is in flight (slow network, lazy SDK chunk).
  const [exchanging, setExchanging] = useState(
    () => !linkError && mode === 'live' && hasCredentials(captured),
  );

  // Exchange the captured credentials once (StrictMode runs effects twice),
  // then drop them from memory whatever the outcome.
  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;
    if (linkError || mode !== 'live' || !hasCredentials(captured)) {
      clearAuthCallback(); // `exchanging` started false for exactly these cases
      return;
    }
    completeSignIn(captured!.params)
      .catch(() => setLinkError('link'))
      .finally(() => {
        clearAuthCallback();
        setExchanging(false);
      });
  }, [captured, completeSignIn, linkError, mode]);
  const [timedOut, setTimedOut] = useState(false);

  useMeta({ title: 'Signing you in', noindex: true });

  const done =
    !!linkError ||
    status === 'authenticated' ||
    timedOut ||
    (mode === 'mock' && status === 'guest');
  useEffect(() => {
    if (!done) return;
    forgetReturnTo();
    if (status === 'authenticated') {
      try {
        window.sessionStorage.removeItem(SENT_EMAIL_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  }, [done, status]);

  useEffect(() => {
    if (linkError || status === 'authenticated' || exchanging) return;
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [linkError, status, timeoutMs, exchanging]);

  if (linkError) return <Navigate to={signInUrl(linkError, returnTo)} replace />;
  if (status === 'authenticated') return <Navigate to={returnTo ?? DEFAULT_RETURN_TO} replace />;
  // Mock mode has no link to wait for: a guest landing here just goes to sign in.
  if (timedOut || (mode === 'mock' && status === 'guest')) {
    return <Navigate to={signInUrl('link', returnTo)} replace />;
  }

  return (
    <AuthCard
      title="Signing you in"
      lead="One moment while we finish your sign-in."
      icon={<span className="auth-spinner" aria-hidden="true" />}
      aria-busy="true"
    >
      <p className="sr-only" role="status" aria-live="polite">
        Signing you in…
      </p>
    </AuthCard>
  );
}
