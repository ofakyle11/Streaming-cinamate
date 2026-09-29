import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import DetailModal from '../components/DetailModal';
import ErrorCard from '../components/errors/ErrorCard';
import { analytics, loadHomeCatalog, type CatalogRow, type Movie } from '../services';
import { withRetry } from '../services/retry';
import { useMeta } from '../hooks/useMeta';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Catalog {
  featured: Movie[];
  rows: CatalogRow[];
}

export default function Home() {
  const [selected, setSelected] = useState<Movie | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const online = useOnlineStatus();
  useMeta();

  useEffect(() => {
    analytics.page('home');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    withRetry(() => loadHomeCatalog(), { maxAttempts: 3, signal: controller.signal })
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the catalogue.');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadKey]);

  const select = (m: Movie) => {
    analytics.track('title_open', { id: m.id, mediaType: m.mediaType });
    setSelected(m);
  };

  if (error && !catalog) {
    // ErrorCard renders its own <main>, so it replaces (not nests in) Home's.
    return (
      <ErrorCard
        title="Couldn't load the catalogue"
        message={
          online
            ? 'The catalogue failed to load. Check your connection and try again.'
            : 'You appear to be offline. Reconnect and try again.'
        }
        onRetry={() => {
          setError(null);
          setReloadKey((k) => k + 1);
        }}
        showHome={false}
      />
    );
  }

  return (
    <>
      {catalog ? (
        // One <main> landmark holds the Hero (and its page <h1>) and the rows.
        <main>
          <Hero featured={catalog.featured} onMore={select} />
          <div className="rows">
            {catalog.rows.map((r) => (
              <Row key={r.title} title={r.title} items={r.items} onSelect={select} />
            ))}
          </div>
        </main>
      ) : (
        <main className="rows" aria-busy="true">
          <div className="hero-card glass" role="status">
            <p>Loading the catalogue…</p>
          </div>
        </main>
      )}
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
