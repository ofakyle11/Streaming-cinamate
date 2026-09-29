import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import DetailModal from '../components/DetailModal';
import GenreChips from '../components/GenreChips';
import { AnalyticsEvents, track } from '../services/analytics/track';
import { type CatalogRow, type Movie } from '../services';
import { loadHomeCatalogSafe } from '../services/discovery';
import { Button } from '../components/ui';

interface Catalog {
  featured: Movie[];
  rows: CatalogRow[];
}

export default function Home() {
  const [selected, setSelected] = useState<Movie | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    loadHomeCatalogSafe()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the catalogue.');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const select = (m: Movie) => {
    track(AnalyticsEvents.titleOpen, { id: m.id, mediaType: m.mediaType, source: 'home' });
    setSelected(m);
  };

  return (
    <>
      {catalog ? (
        <>
          <Hero featured={catalog.featured} onMore={select} />
          <main className="rows">
            {catalog.rows.map((r) => (
              <Row key={r.title} title={r.title} items={r.items} onSelect={select} />
            ))}
            <GenreChips />
          </main>
        </>
      ) : (
        <main className="rows" aria-busy={!error}>
          <div className="hero-card glass" role="status">
            {error ? (
              <>
                <p>{error}</p>
                <Button variant="primary" onClick={retry}>
                  Try again
                </Button>
              </>
            ) : (
              <p>Loading the catalogue…</p>
            )}
          </div>
        </main>
      )}
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
