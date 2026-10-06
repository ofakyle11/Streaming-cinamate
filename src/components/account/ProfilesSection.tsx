import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useActiveProfile, useProfileActions, useProfiles } from '../../hooks';
import ProfileAvatar from '../../features/profiles/ProfileAvatar';
import { canAddProfile, MAX_PROFILES } from '../../features/profiles/rules';

/** Profiles tab: who is on this account, switch the active one, and the full manager at /profiles. */
export default function ProfilesSection() {
  const headingId = useId();
  const profiles = useProfiles();
  const active = useActiveProfile();
  const { setActiveProfile } = useProfileActions();

  return (
    <section className="acct-sec" aria-labelledby={headingId}>
      <h2 id={headingId}>Profiles</h2>
      <p className="acct-lead">
        Each profile keeps its own list, history and ratings. Up to {MAX_PROFILES} per account.
      </p>
      <ul className="acct-list" aria-label="Profiles">
        {profiles.map((p) => {
          const isActive = p.id === active?.id;
          return (
            <li key={p.id} className="acct-row">
              <ProfileAvatar name={p.name} avatar={p.avatar} kid={p.kid} size="sm" />
              <div className="acct-row-text">
                <b>{p.name}</b>
                <span>{p.kid ? 'Kids profile' : 'Standard profile'}</span>
              </div>
              {isActive ? (
                <span className="acct-tag now">Watching now</span>
              ) : (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setActiveProfile(p.id)}
                >
                  Switch to {p.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="acct-actions">
        <Link
          to="/profiles"
          state={{ from: '/account?tab=profiles' }}
          className="btn glass sm acct-link-btn"
        >
          {canAddProfile(profiles) ? 'Add or edit profiles' : 'Edit profiles'}
        </Link>
      </div>
    </section>
  );
}
