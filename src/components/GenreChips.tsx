import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tmdb, type TmdbGenre, type TmdbService } from '../services';
import '../styles/genre.css';

interface Props {
  title?: string;
  svc?: TmdbService;
}

/** "Browse by genre" chip strip linking to /genre/:id. Renders nothing until genres load. */
export default function GenreChips({ title = 'Browse by Genre', svc = tmdb }: Props) {
  const [genres, setGenres] = useState<TmdbGenre[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    svc
      .genres()
      .then((g) => {
        if (!cancelled) setGenres(g);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, [svc]);

  if (!genres || genres.length === 0) return null;

  return (
    <section className="genre-chips" aria-labelledby="genre-chips-title">
      <h2 id="genre-chips-title">{title}</h2>
      <ul>
        {genres.map((g, i) => (
          <li key={g.id} style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}>
            <Link className="genre-chip glass" to={`/genre/${g.id}`}>
              {g.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
