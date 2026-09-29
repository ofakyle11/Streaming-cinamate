import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import DetailModal from '../components/DetailModal';
import { Link } from 'react-router-dom';
import {
  analytics,
  loadHomeCatalog,
  tmdb,
  type CatalogRow,
  type Movie,
  type TmdbGenre,
} from '../services';

interface Catalog {
  featured: Movie[];
  rows: CatalogRow[];
}

export default function Home() {
  const [selected, setSelected] = useState<Movie | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genres, setGenres] = useState<TmdbGenre[]>([]);

  useEffect(() => {
    let cancelled = false;
    tmdb
      .genres()
      .then((g) => {
        if (!cancelled) setGenres(g);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    analytics.page('home');
    loadHomeCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the catalogue.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const select = (m: Movie) => {
    analytics.track('title_open', { id: m.id, mediaType: m.mediaType });
    setSelected(m);
  };

  return (
    <>
      {catalog ? (
        <>
          <Hero featured={catalog.featured} onMore={select} />
          <main className="rows">
            {genres.length > 0 && (
              <nav className="genre-chips" aria-label="Browse by genre">
                {genres.map((g) => (
                  <Link key={g.id} className="chip glass" to={`/genre/${g.id}`}>
                    {g.name}
                  </Link>
                ))}
              </nav>
            )}
            {catalog.rows.map((r) => (
              <Row key={r.title} title={r.title} items={r.items} onSelect={select} />
            ))}
          </main>
        </>
      ) : (
        <main className="rows" aria-busy={!error}>
          <div className="hero-card glass" role="status">
            {error ? <p>{error}</p> : <p>Loading the catalogue…</p>}
          </div>
        </main>
      )}
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
