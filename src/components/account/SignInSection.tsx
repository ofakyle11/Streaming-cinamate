import { FormEvent, useId, useState } from 'react';
import type { User } from '../../services/types';
import { Button } from '../ui';

interface SignInSectionProps {
  user: User;
  /** Absent until the backend offers it; the row then has no action. */
  changeEmail?: (newEmail: string) => Promise<void>;
  onNotice: (notice: { kind: 'success' | 'error' | 'info'; text: string }) => void;
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "How you sign in": the email the links go to, with an inline change form. */
export default function SignInSection({ user, changeEmail, onNotice }: SignInSectionProps) {
  const headingId = useId();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changeEmail) return;
    const next = normalise(email);
    if (!EMAIL_RE.test(next)) {
      setInvalid('Enter a valid email address.');
      return;
    }
    if (next === normalise(user.email)) {
      setInvalid('That is already your sign-in email.');
      return;
    }
    setInvalid(null);
    setBusy(true);
    try {
      await changeEmail(next);
      setEditing(false);
      setEmail('');
      onNotice({
        kind: 'success',
        text: `Check ${user.email} and ${next}: the change takes effect once you confirm the link in both.`,
      });
    } catch (err) {
      onNotice({
        kind: 'error',
        text: err instanceof Error && err.message ? err.message : 'Could not change your email.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="acct-sec" aria-labelledby={headingId}>
      <h2 id={headingId}>How you sign in</h2>
      <p className="acct-lead">
        Lastframe.tv signs you in with a link sent to your email. There is no password to leak.
      </p>
      <div className="acct-row">
        <span className="acct-ic" aria-hidden>
          @
        </span>
        <div className="acct-row-text">
          <b>Email link</b>
          <span>{user.email}</span>
        </div>
        <span className="acct-tag ok">Primary</span>
        {changeEmail && !editing && (
          <Button variant="glass" size="sm" onClick={() => setEditing(true)}>
            Change email
          </Button>
        )}
      </div>
      {changeEmail && editing && (
        <form className="acct-inline-form" onSubmit={(e) => void submit(e)} noValidate>
          <label htmlFor={inputId} className="acct-label">
            New email address
          </label>
          <div className="acct-inline-row">
            <input
              id={inputId}
              className="account-input glass"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? `${inputId}-error` : `${inputId}-hint`}
              onChange={(e) => {
                setEmail(e.target.value);
                if (invalid) setInvalid(null);
              }}
              autoFocus
            />
            <Button type="submit" variant="accent" size="sm" loading={busy}>
              Send confirmation
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {invalid ? (
            <p id={`${inputId}-error`} className="acct-field-error" role="alert">
              {invalid}
            </p>
          ) : (
            <p id={`${inputId}-hint`} className="acct-hint">
              We send a confirmation link to both your current and your new address.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
