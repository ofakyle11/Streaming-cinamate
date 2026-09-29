import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import Row from '../components/Row';
import { Skeleton } from '../components/ui';
import { analytics, loadHomeCatalog, type CatalogRow, type Movie } from '../services';

interface Catalog {
  featured: Movie[];
  rows: CatalogRow[];
}

const SKELETON_ROWS = 8;
const SKELETON_CARDS = 7;

function SkeletonRows() {
  return (
    <main className="rows" aria-busy="true">
      <p role="status" className="home-status">Loading the catalogue…</p>
      {Array.from({ length: SKELETON_ROWS }, (_, r) => (
        <section key={r} className="row in row-skeleton" aria-hidden>
          <h2>
            <Skeleton variant="text" width={180} />
          </h2>
          <div className="track">
            {Array.from({ length: SKELETON_CARDS }, (_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    analytics.page('home');
  }, []);

  useEffect(() => {
    let cancelled = false;
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
  }, [attempt]);

  const retry = () => {
    setError(null);
    setCatalog(null);
    setAttempt((n) => n + 1);
  };
  const track =(m: Movie) => analytics.track('title_open', { id: m.id, mediaType: m.mediaType });
  const openTitle = (m: Movie) => {
    track(m);
    navigate(`/title/${m.mediaType}/${m.id}`);
  };

  if (error) {
    return (
      <main className="rows">
        <div className="hero-card glass home-error" role="alert">
          <p>We couldn't load the catalogue. {error}</p>
          <button type="button" className="btn primary" onClick={retry}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!catalog) return <SkeletonRows />;

  return (
    <>
      <Hero featured={catalog.featured} onMore={openTitle} />
      <main className="rows">
        {catalog.rows.map((r) => (
          <Row key={r.title} title={r.title} items={r.items} onSelect={track} />
        ))}
      </main>
    </>
  );
}
