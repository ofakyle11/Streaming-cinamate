import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import { Button, Skeleton } from '../components/ui';
import { useKeepFocusOnRemoval } from '../hooks/useKeepFocusOnRemoval';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useWatchlistActions } from '../hooks/useWatchlist';
import { MY_LIST_SORTS, sortMyList, useMyListTitles, type MyListSort } from '../hooks/useMyListTitles';
import { analytics, tmdb as defaultTmdb, type Movie, type TmdbService } from '../services';
import '../styles/my-list.css';
import { useMeta } from '../hooks/useMeta';

interface Props {
  /** Injectable for tests; defaults to the active TMDB adapter. */
  svc?: TmdbService;
}

const SKELETON_COUNT = 6;

const itemKey = (m: Movie) => `${m.mediaType}-${m.id}`;

function EmptyState() {
  return (
    <section className="mylist-empty glass" aria-labelledby="mylist-empty-title">
      <span className="mylist-empty-icon" aria-hidden>
        🍿
      </span>
      <h2 id="mylist-empty-title" tabIndex={-1}>
        Your list is empty
      </h2>
      <p className="muted">
        Tap <span className="mylist-empty-plus" aria-hidden>＋</span>
        <span className="mylist-sr-only">the plus button</span> on any poster or title page to save it for later.
      </p>
      <div className="mylist-empty-actions">
        <Link className="btn primary" to="/">
          Browse titles
        </Link>
        <Link className="btn glass" to="/search">
          Search
        </Link>
      </div>
    </section>
  );
}

export default function MyListPage({ svc = defaultTmdb }: Props) {
  useMeta({ title: 'My List', description: 'The films and series you have saved to watch.' });
  const { state, retry } = useMyListTitles(svc);
  const { remove } = useWatchlistActions();
  const [sort, setSort] = useState<MyListSort>('added');

  useEffect(() => {
    analytics.page('my-list');
  }, []);

  const items = state.status === 'ready' ? sortMyList(state.items, sort) : [];
  const count = state.status === 'ready' ? state.items.length : null;
  const empty = state.status === 'ready' && state.items.length === 0 && state.missing.length === 0;

  // Removing a title unmounts its card: keep focus in the grid, else on the empty-state (or page) heading.
  const gridRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const focusKeeper = useKeepFocusOnRemoval(gridRef, items.map(itemKey), {
    fallback: () => document.getElementById('mylist-empty-title') ?? headingRef.current,
    reduceMotion,
  });

  return (
    <main className="mylist-page">
      <header className="mylist-header glass">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            My List
          </h1>
          <p className="muted" aria-live="polite">
            {count === null ? 'Loading your titles…' : count === 1 ? '1 title saved' : `${count} titles saved`}
          </p>
        </div>
        {count !== null && count > 1 && (
          <label className="mylist-sort">
            <span>Sort</span>
            <select className="glass" value={sort} onChange={(e) => setSort(e.target.value as MyListSort)}>
              {MY_LIST_SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {state.status === 'loading' && (
        <div className="mylist-grid" role="status" aria-label="Loading My List">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <section className="mylist-empty glass" role="alert">
          <h2>Couldn’t load My List</h2>
          <p className="muted">{state.message}</p>
          <div className="mylist-empty-actions">
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
          </div>
        </section>
      )}

      {empty && <EmptyState />}

      {state.status === 'ready' && items.length > 0 && (
        <ul className="mylist-grid" aria-label="Saved titles" ref={gridRef} {...focusKeeper}>
          {items.map((m) => (
            <li key={itemKey(m)}>
              <MovieCard movie={m} delay={0} listSource="my-list" />
            </li>
          ))}
        </ul>
      )}

      {state.status === 'ready' && state.missing.length > 0 && (
        <p className="mylist-missing muted">
          {state.missing.length === 1 ? '1 saved title is' : `${state.missing.length} saved titles are`} no longer
          available.{' '}
          <Button variant="ghost" size="sm" onClick={() => state.missing.forEach((e) => remove(e.titleId))}>
            Remove {state.missing.length === 1 ? 'it' : 'them'}
          </Button>
        </p>
      )}
    </main>
  );
}
