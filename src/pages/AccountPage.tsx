import { FormEvent, useId, useState } from 'react';
import ViewingHistoryPanel from '../components/account/ViewingHistoryPanel';
import Page from './Page';
import { Button, Skeleton } from '../components/ui';
import InstallAppCard from '../components/InstallAppCard';
import { useAuth } from '../auth';
import { isValidEmail, normalizeEmail } from '../services/auth/validate';
import type { User } from '../services/types';
import '../styles/account.css';

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;

function errorText(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';
}

function initials(user: User): string {
  const source = user.displayName || user.email;
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function memberSince(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

export default function AccountPage() {
  const { status, user, mode, signInWithMagicLink, signInWithOAuth, signOut, deleteData } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<null | 'magic' | 'google' | 'signout' | 'delete'>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const emailId = useId();
  const noticeId = useId();

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>, success?: string) => {
    setBusy(kind);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const onMagicLink = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setNotice({ kind: 'error', text: 'Enter a valid email address.' });
      return;
    }
    const target = normalizeEmail(email);
    void run(
      'magic',
      () => signInWithMagicLink(target),
      mode === 'live' ? `Check ${target} for your sign-in link.` : undefined,
    );
  };

  const onDelete = () =>
    void run(
      'delete',
      async () => {
        await deleteData();
        setConfirmDelete(false);
      },
      user
        ? 'Your data was deleted from this device and account deletion was requested.'
        : 'Your data was deleted from this device.',
    );

  return (
    <Page title="Account">
      <div className="account">
        {status === 'loading' && (
          <div className="account-loading" aria-busy="true" aria-label="Loading account">
            <Skeleton variant="circle" width={56} height={56} />
            <Skeleton variant="text" width="60%" height={18} />
          </div>
        )}

        {status === 'authenticated' && user && (
          <section className="account-section account-profile glass" aria-label="Signed-in account">
            {user.avatarUrl ? (
              <img className="account-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="account-avatar" aria-hidden>
                {initials(user)}
              </span>
            )}
            <div className="account-identity">
              <strong className="account-name">{user.displayName}</strong>
              <span className="account-email">{user.email}</span>
              {memberSince(user.createdAt) && (
                <span className="account-meta">Member since {memberSince(user.createdAt)}</span>
              )}
            </div>
            <Button
              variant="glass"
              size="sm"
              loading={busy === 'signout'}
              disabled={busy !== null}
              onClick={() => void run('signout', signOut, 'You are signed out. Guest mode is on.')}
            >
              Sign out
            </Button>
          </section>
        )}

        {status === 'guest' && (
          <section className="account-section" aria-labelledby={`${emailId}-heading`}>
            <p className="account-pill">Guest mode</p>
            <h2 id={`${emailId}-heading`} className="account-heading">
              Sign in to sync across devices
            </h2>
            <p className="muted">
              You can keep browsing as a guest. Your list, history and ratings stay on this device until you sign in.
            </p>

            <form className="account-form" onSubmit={onMagicLink} noValidate>
              <label htmlFor={emailId} className="account-label">
                Email
              </label>
              <div className="account-row">
                <input
                  id={emailId}
                  className="account-input glass"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={notice ? noticeId : undefined}
                  aria-invalid={notice?.kind === 'error' || undefined}
                  disabled={busy !== null}
                  required
                />
                <Button type="submit" variant="primary" loading={busy === 'magic'} disabled={busy !== null}>
                  Email me a magic link
                </Button>
              </div>
            </form>

            <div className="account-divider" role="separator" aria-label="or">
              <span>or</span>
            </div>

            <Button
              className="account-google"
              variant="glass"
              loading={busy === 'google'}
              disabled={busy !== null}
              onClick={() => void run('google', () => signInWithOAuth('google'))}
            >
              <span className="account-google-mark" aria-hidden>
                G
              </span>
              Continue with Google
            </Button>

            {mode === 'mock' && (
              <p className="account-demo">Demo mode: no emails are sent and sign-in completes instantly.</p>
            )}
          </section>
        )}

        {notice && (
          <p
            id={noticeId}
            className={`account-notice ${notice.kind}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            {notice.text}
          </p>
        )}

        {status !== 'loading' && (
          <section className="account-section account-danger" aria-labelledby={`${emailId}-danger`}>
            <h2 id={`${emailId}-danger`} className="account-heading">
              Delete my data
            </h2>
            <p className="muted">
              Removes profiles, My List, watch history and ratings from this device
              {user ? ', requests deletion of your cloud data, and signs you out' : ''}. This cannot be undone.
            </p>
            {confirmDelete ? (
              <div className="account-row account-confirm" role="group" aria-label="Confirm data deletion">
                <Button variant="accent" loading={busy === 'delete'} disabled={busy !== null} onClick={onDelete}>
                  Yes, delete everything
                </Button>
                <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="glass" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
                Delete my data…
              </Button>
            )}
          </section>
        )}
        <ViewingHistoryPanel />
        <InstallAppCard />
      </div>
    </Page>
  );
}
