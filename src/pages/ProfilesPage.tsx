import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, useToast } from '../components/ui';
import { useActiveProfile, useProfileActions, useProfiles } from '../hooks';
import ProfileAvatar from '../features/profiles/ProfileAvatar';
import ProfileEditor, { type ProfileDraft } from '../features/profiles/ProfileEditor';
import { suggestAvatar } from '../features/profiles/avatars';
import { canAddProfile, canDeleteProfile, MAX_PROFILES } from '../features/profiles/rules';
import type { Profile } from '../state/store';
import '../features/profiles/profiles.css';

type EditorState = { mode: 'add' } | { mode: 'edit'; profile: Profile } | null;

/** Only same-origin, in-app paths are honoured as a post-selection destination. */
function safeNext(state: unknown): string {
  const next = (state as { from?: unknown } | null)?.from;
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && next !== '/profiles'
    ? next
    : '/';
}

/** "Who's watching?" — pick, add, edit and delete profiles. */
export default function ProfilesPage() {
  const profiles = useProfiles();
  const active = useActiveProfile();
  const { addProfile, updateProfile, removeProfile, setActiveProfile } = useProfileActions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [managing, setManaging] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);

  const canAdd = canAddProfile(profiles);

  const choose = (p: Profile) => {
    if (managing) {
      setEditor({ mode: 'edit', profile: p });
      return;
    }
    setActiveProfile(p.id);
    navigate(safeNext(location.state));
  };

  const handleSave = (draft: ProfileDraft) => {
    if (editor?.mode === 'edit') {
      updateProfile(editor.profile.id, draft);
      toast(`Saved ${draft.name}`, { kind: 'success' });
    } else {
      const created = addProfile(draft);
      toast(`Added ${created.name}`, { kind: 'success' });
    }
    setEditor(null);
  };

  const handleDelete = () => {
    if (editor?.mode !== 'edit' || !canDeleteProfile(profiles)) return;
    removeProfile(editor.profile.id);
    toast(`Deleted ${editor.profile.name}`, { kind: 'info' });
    setEditor(null);
  };

  return (
    <main className="page profiles-page">
      <section className="profiles-shell">
        <h1>{managing ? 'Manage profiles' : "Who's watching?"}</h1>

        <ul className="profile-grid">
          {profiles.map((p, i) => {
            const isActive = p.id === active?.id;
            return (
              <li key={p.id} style={{ ['--i' as string]: i }}>
                <button
                  type="button"
                  className={`profile-tile glass${isActive ? ' active' : ''}${managing ? ' managing' : ''}`}
                  aria-label={
                    managing
                      ? `Edit ${p.name}`
                      : `Watch as ${p.name}${p.kid ? ' (kids)' : ''}${isActive ? ', current profile' : ''}`
                  }
                  aria-current={isActive && !managing ? 'true' : undefined}
                  onClick={() => choose(p)}
                >
                  <ProfileAvatar name={p.name} avatar={p.avatar} kid={p.kid} size="lg" />
                  {managing && (
                    <span className="profile-tile-edit" aria-hidden>
                      ✎
                    </span>
                  )}
                  <span className="profile-tile-name">{p.name}</span>
                </button>
              </li>
            );
          })}

          {canAdd && (
            <li style={{ ['--i' as string]: profiles.length }}>
              <button type="button" className="profile-tile add glass" onClick={() => setEditor({ mode: 'add' })}>
                <span className="lf-avatar lg add-glyph" aria-hidden>
                  +
                </span>
                <span className="profile-tile-name">Add profile</span>
              </button>
            </li>
          )}
        </ul>

        {!canAdd && <p className="muted profiles-note">You can have up to {MAX_PROFILES} profiles.</p>}

        <Button variant={managing ? 'primary' : 'glass'} onClick={() => setManaging((m) => !m)}>
          {managing ? 'Done' : 'Manage profiles'}
        </Button>
      </section>

      {editor && (
        <ProfileEditor
          key={editor.mode === 'edit' ? editor.profile.id : 'new'}
          profile={editor.mode === 'edit' ? editor.profile : undefined}
          profiles={profiles}
          initialAvatar={suggestAvatar(profiles.map((p) => p.avatar))}
          canDelete={canDeleteProfile(profiles)}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditor(null)}
        />
      )}
    </main>
  );
}
