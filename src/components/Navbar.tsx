import { useEffect, useState } from 'react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`navbar glass ${scrolled ? 'scrolled' : ''}`}>
      <div className="logo">CINAMATE</div>
      <ul className="nav-links">
        <li className="active">Home</li>
        <li>Series</li>
        <li>Films</li>
        <li>New &amp; Popular</li>
        <li>My List</li>
      </ul>
      <div className="nav-right">
        <input className="search glass" placeholder="Search" />
        <div className="avatar" />
      </div>
    </nav>
  );
}
