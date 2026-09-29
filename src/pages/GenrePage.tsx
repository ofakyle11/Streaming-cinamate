import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import DetailModal from '../components/DetailModal';
import MovieCard from '../components/MovieCard';
import { Button, Skeleton } from '../components/ui';
import { type DiscoverSort, type Movie } from '../services';
import { AnalyticsEvents, track } from '../services/analytics/track';
import { genreSearch, loadGenrePage, parseGenreQuery, type GenrePageData } from '../services/genre';
import { DISCOVER_SORTS } from '../services/tmdb/sort';
import '../styles/genre.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GenrePageData };

/** A settled result tagged with the request it answers; stale results read as loading. */
type Settled = { key: string } & State;

const SKELETONS = Array.from({ length: 10 }, (_, i) => i);

export default function GenrePage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { genreId, page, sortBy } = parseGenreQuery(id, params);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${genreId}|${page}|${sortBy}|${attempt}`;
  const state: State = settled?.key === requestKey ? settled : { status: 'loading' };

  useEffect(() => {
    if (genreId == null) return;
    let cancelled = false;
    const key = `${genreId}|${page}|${sortBy}|${attempt}`;
    loadGenrePage(genreId, page, sortBy)
      .then((data) => {
        if (!cancelled) setSettled({ key, status: 'ready', data });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSettled({ key, status: 'error', message: e instanceof Error ? e.message : 'Could not load this genre.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [genreId, page, sortBy, attempt]);

  const go = (nextPage: number, nextSort: DiscoverSort) => {
    setParams(new URLSearchParams(genreSearch(nextPage, nextSort)));
    // Optional call: jsdom lacks Element.scrollTo; browsers have it.
    document.scrollingElement?.scrollTo?.({ top: 0 });
  };

  const close = useCallback(() => setSelected(null), []);
  const select = (m: Movie) => {
    track(AnalyticsEvents.titleOpen, { id: m.id, mediaType: m.mediaType, source: 'genre', genreId, page, sortBy });
    setSelected(m);
  };

  const data = state.status === 'ready' ? state.data : null;
  const notFound = genreId == null || (data !== null && data.genre === null);

  if (notFound) {
    return (
      <main className="page">
        <section className="page-card glass">
          <h1>Genre not found</h1>
          <p className="muted">We couldn’t find that genre.</p>
          <Link className="page-link" to="/">Back to Home</Link>
        </section>
      </main>
    );
  }

  const totalPages = data?.totalPages ?? 0;

  return (
    <main className="page genre-page">
      <section className="genre-shell">
        <header className="genre-head glass">
          <div>
            <p className="genre-eyebrow">Genre</p>
            <h1>{data?.genre?.name ?? <Skeleton variant="text" width={180} />}</h1>
            {data && (
              <p className="muted genre-count" aria-live="polite">
                {data.totalResults} {data.totalResults === 1 ? 'title' : 'titles'}
              </p>
            )}
          </div>
          <div className="genre-sort" role="group" aria-label="Sort titles">
            {DISCOVER_SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`genre-sort-btn${s.id === sortBy ? ' active' : ''}`}
                aria-pressed={s.id === sortBy}
                onClick={() => s.id !== sortBy && go(1, s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>

        {state.status === 'error' ? (
          <div className="genre-empty glass" role="alert">
            <p>{state.message}</p>
            <Button variant="glass" size="sm" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
          </div>
        ) : (
          <div className="genre-grid" aria-busy={state.status === 'loading'}>
            {data
              ? data.items.map((m, i) => (
                  <MovieCard key={m.id} movie={m} delay={Math.min(i, 12) * 40} onSelect={select} />
                ))
              : SKELETONS.map((i) => <Skeleton key={i} variant="card" className="genre-skel" />)}
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="muted genre-empty-text">No titles in this genre yet.</p>
        )}

        {totalPages > 1 && data && (
          <nav className="genre-pager" aria-label="Pagination">
            <Button variant="glass" size="sm" disabled={data.page <= 1} onClick={() => go(data.page - 1, sortBy)}>
              ‹ Prev
            </Button>
            <span className="muted" aria-current="page">
              Page {data.page} of {totalPages}
            </span>
            <Button variant="glass" size="sm" disabled={data.page >= totalPages} onClick={() => go(data.page + 1, sortBy)}>
              Next ›
            </Button>
          </nav>
        )}
      </section>
      {selected && <DetailModal movie={selected} onClose={close} />}
    </main>
  );
}
