import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import type { Profile } from '../../state/store';
import { AVATAR_OPTIONS, resolveAvatarId } from './avatars';
import ProfileAvatar from './ProfileAvatar';
import { MAX_NAME_LENGTH, NAME_ERROR_MESSAGES, normalizeName, validateProfileName } from './rules';

export interface ProfileDraft {
  name: string;
  avatar: string;
  kid: boolean;
}

export interface ProfileEditorProps {
  /** Profile being edited; omit to create a new one. */
  profile?: Profile;
  /** All existing profiles (for duplicate-name checks). */
  profiles: readonly Profile[];
  initialAvatar: string;
  canDelete: boolean;
  onSave: (draft: ProfileDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Glass dialog for adding or editing a profile. */
export default function ProfileEditor({
  profile,
  profiles,
  initialAvatar,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: ProfileEditorProps) {
  const isEdit = Boolean(profile);
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState(resolveAvatarId(profile?.avatar ?? initialAvatar));
  const [kid, setKid] = useState(profile?.kid ?? false);
  const [touched, setTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const titleId = useId();
  const nameId = useId();
  const errorId = useId();
  const kidsId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const avatarRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const error = validateProfileName(name, profiles, profile?.id);
  const showError = touched && error;

  // Focus the name field on open and restore focus to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) {
      nameRef.current?.focus();
      return;
    }
    onSave({ name: normalizeName(name), avatar, kid });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (confirmingDelete) setConfirmingDelete(false);
      else onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    // Keep keyboard focus inside the dialog.
    const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Roving tabindex + arrow keys for the avatar radiogroup.
  const handleAvatarKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + AVATAR_OPTIONS.length) % AVATAR_OPTIONS.length;
    setAvatar(AVATAR_OPTIONS[next].id);
    avatarRefs.current[next]?.focus();
  };

  const previewName = normalizeName(name) || profile?.name || '?';

  return (
    <div
      className="modal-backdrop profile-editor-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="profile-editor glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit} noValidate>
          <header className="profile-editor-head">
            <ProfileAvatar name={previewName} avatar={avatar} kid={kid} size="lg" />
            <h2 id={titleId}>{isEdit ? 'Edit profile' : 'Add profile'}</h2>
          </header>

          <div className="field">
            <label htmlFor={nameId}>Name</label>
            <input
              ref={nameRef}
              id={nameId}
              className="text-input glass"
              value={name}
              maxLength={MAX_NAME_LENGTH + 10}
              autoComplete="off"
              aria-invalid={showError ? true : undefined}
              aria-describedby={showError ? errorId : undefined}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            {showError && (
              <p id={errorId} className="field-error" role="alert">
                {NAME_ERROR_MESSAGES[error]}
              </p>
            )}
          </div>

          <fieldset className="field">
            <legend>Avatar</legend>
            <div className="avatar-picker" role="radiogroup" aria-label="Avatar">
              {AVATAR_OPTIONS.map((opt, i) => {
                const checked = opt.id === avatar;
                return (
                  <button
                    key={opt.id}
                    ref={(el) => {
                      avatarRefs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={opt.label}
                    tabIndex={checked ? 0 : -1}
                    className={`avatar-choice${checked ? ' selected' : ''}`}
                    onClick={() => setAvatar(opt.id)}
                    onKeyDown={(e) => handleAvatarKey(e, i)}
                  >
                    <ProfileAvatar name={previewName} avatar={opt.id} size="sm" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="field kids-toggle">
            <input id={kidsId} type="checkbox" role="switch" checked={kid} onChange={(e) => setKid(e.target.checked)} />
            <label htmlFor={kidsId}>
              <span className="kids-toggle-title">Kids profile</span>
              <span className="muted">Only shows titles rated for kids (G, PG, TV-Y, TV-G, TV-PG).</span>
            </label>
          </div>

          {confirmingDelete ? (
            <div className="delete-confirm glass" role="alert">
              <p>
                Delete <strong>{profile?.name}</strong>? Their list, watch history and ratings will be removed.
              </p>
              <div className="actions">
                <Button variant="accent" onClick={onDelete}>
                  Delete profile
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </Button>
              </div>
            </div>
          ) : (
            <div className="profile-editor-actions">
              <Button type="submit" variant="primary">
                {isEdit ? 'Save' : 'Add profile'}
              </Button>
              <Button variant="glass" onClick={onClose}>
                Cancel
              </Button>
              {isEdit && onDelete && (
                <Button
                  variant="ghost"
                  className="danger"
                  disabled={!canDelete}
                  title={canDelete ? undefined : 'At least one profile is required'}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
