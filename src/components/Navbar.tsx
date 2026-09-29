import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/genre/series', label: 'Series' },
  { to: '/genre/films', label: 'Films' },
  { to: '/genre/new', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

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
            <NavLink to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
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
