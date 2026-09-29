import { useEffect, useState } from 'react';
import type { Movie } from '../services';
import { AnalyticsEvents, track } from '../services/analytics/track';

interface Props {
  featured: Movie[];
  onMore: (m: Movie) => void;
}

export default function Hero({ featured, onMore }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Nothing to rotate with 0-1 features (and avoids `% 0`); no auto-advance under reduced motion.
    if (featured.length <= 1) return;
    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % featured.length), 7000);
    return () => clearInterval(t);
  }, [featured.length]);

  if (featured.length === 0) return null;

  const movie = featured[index] ?? featured[0];

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
          <button
            className="btn primary"
            onClick={() => track(AnalyticsEvents.playTrailer, { id: movie.id, mediaType: movie.mediaType, source: 'hero' })}
          >
            ▶ Play
          </button>
          <button className="btn glass" onClick={() => onMore(movie)}>ⓘ More Info</button>
        </div>
      </div>
      <div className="hero-dots">
        {featured.map((m, i) => (
          <button
            key={m.id}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
            aria-label={`Show ${m.title}`}
          />
        ))}
      </div>
    </header>
  );
}
