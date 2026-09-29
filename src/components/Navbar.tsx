import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/search?type=tv', label: 'Series' },
  { to: '/search?type=movie', label: 'Films' },
  { to: '/new', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
];

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

  return (
    <nav className={`navbar glass ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="logo">LAST FRAME</Link>
      <ul className="nav-links">
        {links.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => (isNavLinkActive(l.to, isActive, location.search) ? 'active' : '')}
              aria-current={isNavLinkActive(l.to, true, location.search) ? 'page' : 'false'}
            >
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="nav-right">
        <form role="search" onSubmit={submitSearch}>
          <input
            className="search glass"
            type="search"
            placeholder="Search"
            aria-label="Search titles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <Link to="/profiles" className="avatar" aria-label="Profiles" />
      </div>
    </nav>
  );
}
