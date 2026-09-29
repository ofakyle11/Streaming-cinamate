import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import LogoMark from './brand/LogoMark';
import IconButton from './ui/IconButton';
import '../styles/nav.css';

const links = [
  { to: '/', label: 'Home' },
  { to: '/genre/series', label: 'Series' },
  { to: '/genre/films', label: 'Films' },
  { to: '/genre/new', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
];

const MENU_ID = 'primary-nav-links';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  // The mobile menu remembers the pathname it was opened on, so any route change
  // closes it without a state-syncing effect.
  const { pathname } = useLocation();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const menuOpen = openOnPath === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeAndRestoreFocus = useCallback(() => {
    setOpenOnPath(null);
    toggleRef.current?.focus();
  }, []);

  // While open, Escape and outside clicks close the menu and return focus to the toggle.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndRestoreFocus();
      }
    };
    const onPointerDown = (e: Event) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (toggleRef.current?.contains(target) || listRef.current?.contains(target)) return;
      closeAndRestoreFocus();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [menuOpen, closeAndRestoreFocus]);

  return (
    <nav className={`navbar glass ${scrolled ? 'scrolled' : ''}`} aria-label="Primary">
      <Link to="/" className="logo logo--with-mark" aria-label="Last Frame home">
        <LogoMark size={30} decorative />
        LAST FRAME
      </Link>
      <IconButton
        ref={toggleRef}
        label="Menu"
        className="nav-toggle"
        aria-expanded={menuOpen}
        aria-controls={MENU_ID}
        onClick={() => setOpenOnPath(menuOpen ? null : pathname)}
      >
        <span className="nav-toggle-icon" aria-hidden="true">
          {menuOpen ? '✕' : '☰'}
        </span>
      </IconButton>
      <ul id={MENU_ID} ref={listRef} className={`nav-links${menuOpen ? ' is-open' : ''}`}>
        {links.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setOpenOnPath(null)}
            >
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="nav-right">
        <input
          className="search glass"
          type="search"
          placeholder="Search"
          aria-label="Search titles"
        />
        <Link to="/profiles" className="avatar" aria-label="Profiles" />
      </div>
    </nav>
  );
}
