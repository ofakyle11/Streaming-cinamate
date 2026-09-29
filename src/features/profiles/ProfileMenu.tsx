import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useActiveProfile, useProfileActions, useProfiles } from '../../hooks';
import ProfileAvatar from './ProfileAvatar';
import './profiles.css';

/** Navbar control: shows the active profile and lets you switch or manage profiles. */
export default function ProfileMenu() {
  const profiles = useProfiles();
  const active = useActiveProfile();
  const { setActiveProfile } = useProfileActions();
  const location = useLocation();
  // The menu remembers the path it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === location.pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenAt((prev) => {
      const wasOpen = prev === location.pathname;
      const value = typeof next === 'function' ? next(wasOpen) : next;
      return value ? location.pathname : null;
    });
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]');
    const checked = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (checked ?? items?.[0])?.focus();
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  if (!active) {
    return <Link to="/profiles" className="avatar" aria-label="Choose a profile" />;
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Profile: ${active.name}${active.kid ? ' (kids)' : ''}. Switch profile`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <ProfileAvatar name={active.name} avatar={active.avatar} size="sm" />
        <span className="profile-trigger-name">{active.name}</span>
        {active.kid && <span className="kids-pill">Kids</span>}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="profile-dropdown glass"
          role="menu"
          aria-label="Switch profile"
          onKeyDown={onMenuKey}
        >
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === active.id}
              tabIndex={-1}
              className={`profile-dropdown-item${p.id === active.id ? ' active' : ''}`}
              onClick={() => {
                setActiveProfile(p.id);
                close();
              }}
            >
              <ProfileAvatar name={p.name} avatar={p.avatar} size="sm" />
              <span>{p.name}</span>
              {p.kid && <span className="kids-pill">Kids</span>}
            </button>
          ))}
          <div className="profile-dropdown-sep" role="separator" />
          <Link to="/profiles" role="menuitem" tabIndex={-1} className="profile-dropdown-item manage">
            Manage profiles
          </Link>
        </div>
      )}
    </div>
  );
}
