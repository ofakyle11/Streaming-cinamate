import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/genre/series', label: 'Series' },
  { to: '/genre/films', label: 'Films' },
  { to: '/genre/new', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

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
        <input className="search glass" placeholder="Search" />
        <Link to="/profiles" className="avatar" aria-label="Profiles" />
      </div>
    </nav>
  );
}
