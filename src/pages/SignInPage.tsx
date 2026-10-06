import { FormEvent, useId, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AuthCard from '../components/auth/AuthCard';
import { Button } from '../components/ui';
import { useAuth } from '../auth';
import { googleSignInEnabled } from '../auth/flags';
import { rememberReturnTo, resolveReturnTo } from '../auth/returnTo';
import { isValidEmail, normalizeEmail } from '../services/auth/validate';
import { useMeta } from '../hooks/useMeta';
import Turnstile from '../components/auth/Turnstile';
import { useCaptcha } from '../auth/useCaptcha';

/** `?error=` values the callback page sends us back with. */
export type SignInError = 'expired' | 'link';

export const SENT_EMAIL_KEY = 'lf.auth.sentTo';

function errorText(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Something went wrong. Please try again.';
}

function readError(raw: string | null): SignInError | null {
  return raw === 'expired' || raw === 'link' ? raw : null;
}

export interface SignInPageProps {
  /** Override the Google flag (tests). Defaults to VITE_AUTH_GOOGLE. */
  googleEnabled?: boolean;
}

/**
 * /sign-in: email link only at launch. Guests type their email; in live mode
 * we send the link and move to /sign-in/sent, in mock mode the session starts
 * at once. Signed-in users are sent on to `returnTo` (same-origin paths only).
 */
export default function SignInPage({ googleEnabled = googleSignInEnabled() }: SignInPageProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status, mode, signInWithMagicLink, signInWithOAuth } = useAuth();
  const returnTo = resolveReturnTo(params.get('returnTo'));
  const linkError = readError(params.get('error'));
  const isNew = params.get('new') === '1';
  const prefill = params.get('email');
  const [email, setEmail] = useState(() =>
    prefill && isValidEmail(prefill) ? normalizeEmail(prefill) : '',
  );
  const [busy, setBusy] = useState<null | 'magic' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);
  // Only a rejected address marks the field invalid; a failed send is not the field's fault.
  const [fieldError, setFieldError] = useState(false);
  const captcha = useCaptcha();
  const emailId = useId();
  const errorId = useId();

  useMeta({
    title: isNew ? 'Get started' : 'Sign in',
    description: 'Sign in to Lastframe.tv with a link sent to your email. No password to remember.',
  });

  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setFieldError(false);
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      setFieldError(true);
      return;
    }
    const target = normalizeEmail(email);
    void run('magic', async () => {
      // The live link comes back through /auth/callback, which reads this.
      if (mode === 'live') rememberReturnTo(returnTo);
      try {
        await signInWithMagicLink(target, captcha.options());
      } finally {
        captcha.spend();
      }
      if (mode === 'live') {
        try {
          window.sessionStorage.setItem(SENT_EMAIL_KEY, target);
        } catch {
          /* private mode: the sent page still has the router state */
        }
        navigate('/sign-in/sent', {
          state: { email: target, returnTo },
          replace: linkError !== null,
        });
      } else {
        // Mock adapter: the "link" was clicked for us; AuthProvider now reports
        // authenticated and the <Navigate> above takes over on the next render.
        setBusy(null);
      }
    });
  };

  const onGoogle = () =>
    void run('google', async () => {
      rememberReturnTo(returnTo);
      await signInWithOAuth('google');
      setBusy(null);
    });

  const loading = status === 'loading';
  const title = isNew ? 'Get started with Lastframe.tv' : 'Sign in to Lastframe.tv';
  const lead = isNew
    ? 'One link in your inbox creates your account. No password to remember.'
    : 'One link in your inbox. No password to remember.';

  return (
    <AuthCard
      as="form"
      title={title}
      lead={lead}
      onSubmit={onSubmit}
      noValidate
      aria-busy={loading || undefined}
    >
      {linkError && !error && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>
            {linkError === 'expired' ? (
              <>
                <b>That link has expired.</b> Sign-in links work once and last 15 minutes. Enter
                your email and we will send a fresh one.
              </>
            ) : (
              <>
                <b>That link did not work.</b> It may have been used already. Enter your email and
                we will send a new one.
              </>
            )}
          </span>
        </div>
      )}
      {error && (
        <p id={errorId} className="auth-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
      <label htmlFor={emailId} className="auth-label">
        Email
      </label>
      <input
        id={emailId}
        className="auth-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={fieldError || undefined}
        disabled={busy !== null || loading}
        autoFocus={!!linkError}
        required
      />
      {captcha.required && <Turnstile {...captcha.widget} />}
      <Button
        type="submit"
        variant="accent"
        loading={busy === 'magic'}
        disabled={busy !== null || loading || !captcha.ready}
      >
        {linkError ? 'Send a new link' : 'Email me a sign-in link'}
      </Button>

      {googleEnabled && (
        <>
          <div className="auth-or" role="separator" aria-label="or">
            or
          </div>
          <Button
            variant="glass"
            loading={busy === 'google'}
            disabled={busy !== null || loading}
            onClick={onGoogle}
          >
            <span className="auth-google-mark" aria-hidden="true">
              G
            </span>
            Continue with Google
          </Button>
        </>
      )}

      <p className="auth-fine">
        By continuing you agree to the <Link to="/terms">Terms</Link> and{' '}
        <Link to="/privacy">Privacy policy</Link>. We never post or email on your behalf.
      </p>
      {mode === 'mock' && (
        <p className="auth-demo">Demo mode: no email is sent and sign-in completes instantly.</p>
      )}
    </AuthCard>
  );
}
