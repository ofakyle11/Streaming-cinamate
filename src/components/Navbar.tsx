import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import ProfileMenu from '../features/profiles/ProfileMenu';
import BrandMark from './brand/BrandMark';
import { useActiveBrand } from './brand/activeBrand';
import IconButton from './ui/IconButton';
import ThemeToggle from './ui/ThemeToggle';
import '../styles/nav.css';

const links = [
  { to: '/', label: 'Home' },
  { to: '/search?type=tv', label: 'Series' },
  { to: '/search?type=movie', label: 'Films' },
  { to: '/new', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
];

const MENU_ID = 'primary-nav-links';

/**
 * NavLink matches on pathname only, so `/search?type=tv` and `/search?type=movie`
 * would both read as active on any /search URL. For links that carry a `type`
 * search param, also require the current `type` param to match.
 */
function isNavLinkActive(to: string, pathActive: boolean, currentSearch: string): boolean {
  if (!pathActive) return false;
  const qIndex = to.indexOf('?');
  if (qIndex === -1) return true;
  const wanted = new URLSearchParams(to.slice(qIndex + 1)).get('type');
  if (wanted == null) return true;
  return new URLSearchParams(currentSearch).get('type') === wanted;
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  // The mobile menu remembers the pathname it was opened on, so any route change
  // closes it without a state-syncing effect.
  const { pathname } = location;
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const menuOpen = openOnPath === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const brand = useActiveBrand();

  const submitSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    setQuery('');
  };

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
      <Link
        to="/"
        className="logo logo--with-mark"
        aria-label="Lastframe.tv home"
        data-logo-slot="header"
        viewTransition
      >
        <LogoMark size={30} decorative />
        <span className="logo-wordmark">Lastframe<span className="logo-tv">.tv</span></span>
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
        {/* Phones and tablets (<=1024px): the theme control is the first row of the menu sheet. */}
        <li className="nav-theme nav-theme-menu">
          <ThemeToggle />
        </li>
        {links.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                isNavLinkActive(l.to, isActive, location.search) ? 'active' : ''
              }
              aria-current={isNavLinkActive(l.to, true, location.search) ? 'page' : 'false'}
              onClick={() => setOpenOnPath(null)}
              viewTransition
            >
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="nav-right">
        {/* Desktop (>1024px): left of search. Hidden below that, where the menu sheet has it. */}
        <div className="nav-theme nav-theme-desktop">
          <ThemeToggle />
        </div>
        <form role="search" onSubmit={submitSearch}>
          <input
            className="search glass"
            type="search"
            placeholder="Search"
            aria-label="Search titles"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <ProfileMenu />
      </div>
    </nav>
  );
}
