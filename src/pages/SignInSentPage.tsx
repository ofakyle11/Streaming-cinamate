import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthCard from '../components/auth/AuthCard';
import { Button } from '../components/ui';
import { useAuth } from '../auth';
import { rememberReturnTo, resolveReturnTo, signInHref } from '../auth/returnTo';
import { isValidEmail } from '../services/auth/validate';
import { useMeta } from '../hooks/useMeta';
import { SENT_EMAIL_KEY } from './SignInPage';

/** Seconds before "Resend link" is available (the mockup counts down from 0:45). */
export const RESEND_COOLDOWN_S = 45;

function errorText(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Could not resend the link. Please try again.';
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SentState {
  email?: unknown;
  returnTo?: unknown;
}

function readSentEmail(state: SentState | null): string | null {
  if (state && typeof state.email === 'string' && isValidEmail(state.email)) return state.email;
  try {
    const stored = window.sessionStorage.getItem(SENT_EMAIL_KEY);
    return stored && isValidEmail(stored) ? stored : null;
  } catch {
    return null;
  }
}

export interface SignInSentPageProps {
  /** Override the cooldown (tests). */
  cooldownSeconds?: number;
}

/**
 * /sign-in/sent: the link is in the inbox. Shows the address, what to expect,
 * and a resend button that unlocks after a cooldown so the inbox is not
 * flooded. Reached with router state from /sign-in; a reload still works via
 * sessionStorage, and with nothing to show we go back to /sign-in.
 */
export default function SignInSentPage({
  cooldownSeconds = RESEND_COOLDOWN_S,
}: SignInSentPageProps) {
  const location = useLocation();
  const { status, signInWithMagicLink } = useAuth();
  const state = (location.state ?? null) as SentState | null;
  const [email] = useState(() => readSentEmail(state));
  const returnTo = resolveReturnTo(typeof state?.returnTo === 'string' ? state.returnTo : null);
  const [left, setLeft] = useState(cooldownSeconds);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useMeta({ title: 'Check your email', noindex: true });

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [left]);

  if (status === 'authenticated') return <Navigate to={returnTo} replace />;
  if (!email) return <Navigate to={signInHref(returnTo)} replace />;

  const resend = async () => {
    setBusy(true);
    setNotice(null);
    try {
      rememberReturnTo(returnTo); // refresh the TTL for the new link
      await signInWithMagicLink(email);
      setNotice({ kind: 'success', text: 'A new link is on its way.' });
      setLeft(cooldownSeconds);
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const icon = (
    <span className="auth-sent-icon">
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3.5 7 8.5 6 8.5-6" />
      </svg>
    </span>
  );

  return (
    <AuthCard title="Check your email" lead="We sent a sign-in link to" icon={icon}>
      <p className="auth-sent-email">{email}</p>
      <ul className="auth-sent-list">
        <li>Open the link on this device to finish signing in.</li>
        <li>The link works once and expires in 15 minutes.</li>
        <li>Nothing arrived? Check spam, then resend.</li>
      </ul>
      <Button
        variant="glass"
        loading={busy}
        disabled={busy || left > 0}
        onClick={() => void resend()}
      >
        {left > 0 ? (
          <>
            Resend link in <span className="auth-countdown">{formatClock(left)}</span>
          </>
        ) : (
          'Resend link'
        )}
      </Button>
      {/* One polite live region for the countdown's end and the resend result. */}
      <p className="sr-only" role="status" aria-live="polite">
        {left === 0 && !notice ? 'You can resend the link now.' : ''}
      </p>
      {notice && (
        <p
          className={notice.kind === 'error' ? 'auth-error' : 'auth-status'}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          <span aria-hidden="true">{notice.kind === 'error' ? '⚠' : '✓'}</span>
          <span>{notice.text}</span>
        </p>
      )}
      <div className="auth-help">
        <Link to={signInHref(returnTo)}>Use a different email</Link>
      </div>
    </AuthCard>
  );
}
