import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthCard from '../components/auth/AuthCard';
import { useAuth } from '../auth';
import { DEFAULT_RETURN_TO, takeReturnTo } from '../auth/returnTo';
import { useMeta } from '../hooks/useMeta';
import { readCallbackError } from '../auth/callbackError';
import type { SignInError } from './SignInPage';

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
 * /auth/callback: the magic link (or OAuth) lands here. The live adapter's
 * client reads the token from the URL and AuthProvider flips to authenticated;
 * we then continue to the remembered page. A link that failed (expired, used)
 * goes back to /sign-in with the reason; so does a link that never resolves.
 */
export default function AuthCallbackPage({
  timeoutMs = CALLBACK_TIMEOUT_MS,
}: AuthCallbackPageProps) {
  const location = useLocation();
  const { status, mode } = useAuth();
  // Read the remembered path once; the link is single-use and so is the path.
  const [returnTo] = useState(() => takeReturnTo());
  const [linkError] = useState(() => readCallbackError(location.search, location.hash));
  const [timedOut, setTimedOut] = useState(false);

  useMeta({ title: 'Signing you in', noindex: true });

  useEffect(() => {
    if (linkError || status === 'authenticated') return;
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [linkError, status, timeoutMs]);

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
      icon={<span className="auth-spinner" />}
      aria-busy="true"
      role="status"
    />
  );
}
