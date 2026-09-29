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
          {movie.rating && <span className="badge">{movie.rating}</span>}
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
