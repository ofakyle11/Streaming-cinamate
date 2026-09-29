import { useCallback, useEffect, useState } from 'react';
import Row from '../components/Row';
import DetailModal from '../components/DetailModal';
import { Button, Skeleton } from '../components/ui';
import { analytics, tmdb as defaultTmdb, type CatalogRow, type Movie, type TmdbService } from '../services';
import { loadNewPopular } from '../services/discovery';
import '../styles/discovery.css';

interface Props {
  /** Injectable for tests; defaults to the active TMDB adapter. */
  svc?: TmdbService;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: CatalogRow[] };

type Settled = { attempt: number } & State;

const SKELETON_ROWS = [0, 1, 2];
const SKELETON_CARDS = [0, 1, 2, 3, 4, 5];

export default function NewPopularPage({ svc = defaultTmdb }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [selected, setSelected] = useState<Movie | null>(null);
  const state: State = settled?.attempt === attempt ? settled : { status: 'loading' };

  useEffect(() => {
    let cancelled = false;
    analytics.page('new_popular');
    loadNewPopular(svc)
      .then((rows) => {
        if (!cancelled) setSettled({ attempt, status: 'ready', rows });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSettled({
            attempt,
            status: 'error',
            message: e instanceof Error ? e.message : 'Could not load New & Popular.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [svc, attempt]);

  const close = useCallback(() => setSelected(null), []);
  const select = (m: Movie) => {
    analytics.track('title_open', { id: m.id, mediaType: m.mediaType, from: 'new_popular' });
    setSelected(m);
  };

  return (
    <main className="page discovery-page">
      <section className="discovery-shell">
        <header className="discovery-head glass">
          <p className="discovery-eyebrow">Discover</p>
          <h1>New &amp; Popular</h1>
          <p className="muted">What everyone is watching this week and what is arriving next.</p>
        </header>

        {state.status === 'error' && (
          <div className="discovery-state glass" role="alert">
            <p>{state.message}</p>
            <Button variant="glass" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="discovery-loading" aria-busy="true" role="status" aria-label="Loading New & Popular">
            {SKELETON_ROWS.map((r) => (
              <div key={r} className="discovery-skel-row">
                <Skeleton variant="text" width={160} />
                <div className="discovery-skel-track">
                  {SKELETON_CARDS.map((c) => (
                    <Skeleton key={c} variant="card" className="discovery-skel-card" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {state.status === 'ready' && state.rows.length === 0 && (
          <p className="muted discovery-state glass">Nothing new right now. Check back soon.</p>
        )}

        {state.status === 'ready' && state.rows.length > 0 && (
          <div className="discovery-rows">
            {state.rows.map((r) => (
              <Row key={r.title} title={r.title} items={r.items} onSelect={select} />
            ))}
          </div>
        )}
      </section>
      {selected && <DetailModal movie={selected} onClose={close} />}
    </main>
  );
}
