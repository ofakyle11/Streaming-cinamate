import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import DetailModal from '../components/DetailModal';
import GenreChips from '../components/GenreChips';
import { analytics, loadHomeCatalog, type CatalogRow, type Movie } from '../services';

interface Catalog {
  featured: Movie[];
  rows: CatalogRow[];
}

export default function Home() {
  const [selected, setSelected] = useState<Movie | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            {catalog.rows.map((r) => (
              <Row key={r.title} title={r.title} items={r.items} onSelect={select} />
            ))}
            <GenreChips />
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
