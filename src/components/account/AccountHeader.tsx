import { Link } from 'react-router-dom';
import type { User } from '../../services/types';
import { signInHref } from '../../auth/returnTo';
import { Skeleton } from '../ui';

function initials(user: User): string {
  const source = user.displayName || user.email;
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function memberSince(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

interface AccountHeaderProps {
  status: 'loading' | 'guest' | 'authenticated';
  user: User | null;
  /** Whether the local store is linked to the cloud copy (live mode, signed in). */
  synced: boolean;
}

/** Identity card at the top of the account page: who you are, or the guest pitch. */
export default function AccountHeader({ status, user, synced }: AccountHeaderProps) {
  if (status === 'loading') {
    return (
      <header className="acct-head glass" aria-busy="true" aria-label="Loading account">
        <Skeleton variant="circle" width={64} height={64} />
        <div className="acct-head-text">
          <Skeleton variant="text" width="40%" height={22} />
          <Skeleton variant="text" width="60%" height={16} />
        </div>
      </header>
    );
  }

  if (status === 'authenticated' && user) {
    const since = memberSince(user.createdAt);
    return (
      <header className="acct-head glass" aria-label="Signed-in account">
        {user.avatarUrl ? (
          <img className="acct-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="acct-avatar" aria-hidden>
            {initials(user)}
          </span>
        )}
        <div className="acct-head-text">
          <h1 className="acct-name">{user.displayName}</h1>
          <p className="acct-sub">
            <span className="acct-email">{user.email}</span>
            {since && <span className="acct-since"> · member since {since}</span>}
          </p>
        </div>
        <span className={`acct-sync${synced ? ' is-on' : ''}`}>
          <i aria-hidden />
          {synced ? 'Synced to your account' : 'Saved on this device'}
        </span>
      </header>
    );
  }

  return (
    <header className="acct-head glass acct-head-guest" aria-label="Guest account">
      <span className="acct-avatar acct-avatar-guest" aria-hidden>
        ?
      </span>
      <div className="acct-head-text">
        <p className="acct-pill">Guest mode</p>
        <h1 className="acct-name">Sign in to sync across devices</h1>
        <p className="acct-sub">
          Your list, history and ratings stay on this device until you sign in, then they come with
          you.
        </p>
      </div>
      <Link to={signInHref('/account')} className="btn accent acct-signin">
        Sign in with an email link
      </Link>
    </header>
  );
}
