import { useEffect, useState } from 'react';
import type { Movie } from '../services';

interface Props {
  featured: Movie[];
  onMore: (m: Movie) => void;
}

export default function Hero({ featured, onMore }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // WCAG 2.2.2 / reduced motion: no auto-rotation when the user asks for less motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % featured.length), 7000);
    return () => clearInterval(t);
  }, [featured.length]);

  const movie = featured[index];

  return (
    <header className="hero">
      {featured.map((m, i) => (
        <div
          key={m.id}
          className={`hero-bg ${i === index ? 'active' : ''}`}
          style={{ backgroundImage: `url(${m.backdrop})` }}
        />
      ))}
      <div className="hero-fade" />
      <div className="hero-card glass" key={movie.id}>
        <h1>{movie.title}</h1>
        <div className="meta">
          <span className="match">{movie.match}% Match</span>
          <span>{movie.year}</span>
          <span className="badge">{movie.rating}</span>
          <span>{movie.genres.join(' · ')}</span>
        </div>
        <p>{movie.description}</p>
        <div className="actions">
          <button className="btn primary">
            <span aria-hidden="true">▶ </span>Play
          </button>
          <button className="btn glass" onClick={() => onMore(movie)}>
            <span aria-hidden="true">ⓘ </span>More Info
          </button>
        </div>
      </div>
      <div className="hero-dots" role="group" aria-label="Featured titles">
        {featured.map((m, i) => (
          <button
            key={m.id}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
            aria-label={`Show ${m.title}`}
            aria-pressed={i === index}
          />
        ))}
      </div>
    </header>
  );
}
