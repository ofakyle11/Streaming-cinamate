import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import DetailModal from '../components/DetailModal';
import { Button, Skeleton } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { analytics, tmdb as defaultTmdb, type Movie, type TmdbGenre, type TmdbService } from '../services';
import {
  EMPTY_FILTERS,
  RATING_STEPS,
  hasActiveFilters,
  parseFilters,
  writeFilters,
  type SearchFilters,
} from '../features/search/filters';
import { useInfiniteSearch } from '../features/search/useInfiniteSearch';
import { AnalyticsEvents, track } from '../services/analytics/track';
import '../styles/search.css';

export const SEARCH_DEBOUNCE_MS = 300;
const FIRST_YEAR = 1950;

interface Props {
  /** Injectable for tests; defaults to the active TMDB adapter. */
  svc?: TmdbService;
}

const TYPE_OPTIONS: Array<{ value: SearchFilters['type']; label: string }> = [
  { value: null, label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV' },
];

export default function SearchPage({ svc = defaultTmdb }: Props) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const paramsKey = params.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(paramsKey)), [paramsKey]);

  /* ------------------------------------------------ debounced query input */
  const [text, setText] = useState(q);
  const debounced = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    // URL changed. If it was not our own debounced write (e.g. navbar search), adopt it.
    setSyncedQ(q);
    if (q.trim() !== debounced.trim()) setText(q);
  }

  const lastDebounced = useRef(debounced);
  useEffect(() => {
    if (debounced === lastDebounced.current) return;
    lastDebounced.current = debounced;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const value = debounced.trim();
        if ((prev.get('q') ?? '') === value) return prev;
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [debounced, setParams]);

  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setParams((prev) => writeFilters(prev, { ...parseFilters(prev), ...patch }), { replace: true });
    },
    [setParams],
  );

  /* ------------------------------------------------------------- genres */
  const [genres, setGenres] = useState<TmdbGenre[]>([]);
  useEffect(() => {
    let cancelled = false;
    svc
      .genres()
      .then((g) => {
        if (!cancelled) setGenres(g);
      })
      .catch(() => {
        /* Genre chips are optional; results still load. */
      });
    return () => {
      cancelled = true;
    };
  }, [svc]);

  useEffect(() => {
    analytics.page('search');
  }, []);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed) track(AnalyticsEvents.search, { query: trimmed.slice(0, 100), length: trimmed.length });
  }, [q]);

  /* ------------------------------------------------------------ results */
  const query = q.trim();
  const { items, status, error, hasMore, loadMore, retry } = useInfiniteSearch(query, filters, svc);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasIO = typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function';

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasIO || !hasMore || status !== 'ready') return;
    const io = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // Re-observe after every page so a still-visible sentinel keeps loading.
  }, [hasIO, hasMore, status, loadMore, items.length]);

  const [selected, setSelected] = useState<Movie | null>(null);
  const select = (m: Movie) => {
    analytics.track('title_open', { id: m.id, mediaType: m.mediaType, source: 'search' });
    setSelected(m);
  };
  const closeModal = useCallback(() => setSelected(null), []);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - FIRST_YEAR + 2 }, (_, i) => now + 1 - i);
  }, []);

  const active = hasActiveFilters(filters);
  const initialLoading = status === 'loading' && items.length === 0;
  const isEmpty = status === 'ready' && items.length === 0 && !hasMore;
  const heading = query ? `Results for “${query}”` : active ? 'Filtered titles' : 'Browse everything';

  return (
    <main className="search-page">
      <section className="search-head glass" aria-label="Search">
        <form
          role="search"
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            lastDebounced.current = text;
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                if (text.trim()) next.set('q', text.trim());
                else next.delete('q');
                return next;
              },
              { replace: true },
            );
          }}
        >
          <label htmlFor="search-input" className="search-sr-only">
            Search titles
          </label>
          <input
            id="search-input"
            className="search-input"
            type="search"
            value={text}
            autoComplete="off"
            placeholder="Search films and series"
            onChange={(e) => setText(e.target.value)}
          />
          {text && (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setText('')}>
              ×
            </button>
          )}
        </form>

        <div className="search-filters" aria-label="Filters">
          <div className="chip-group" role="group" aria-label="Type">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                className={`chip glass${filters.type === o.value ? ' on' : ''}`}
                aria-pressed={filters.type === o.value}
                onClick={() => updateFilters({ type: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="chip-group" role="group" aria-label="Minimum rating">
            {RATING_STEPS.map((r) => (
              <button
                key={r}
                type="button"
                className={`chip glass${filters.minRating === r ? ' on' : ''}`}
                aria-pressed={filters.minRating === r}
                onClick={() => updateFilters({ minRating: filters.minRating === r ? null : r })}
              >
                ★ {r}+
              </button>
            ))}
          </div>

          <div className="chip-group" role="group" aria-label="Year range">
            <label className="chip glass chip-select">
              <span>From</span>
              <select
                aria-label="Year from"
                value={filters.yearFrom ?? ''}
                onChange={(e) => updateFilters({ yearFrom: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="chip glass chip-select">
              <span>To</span>
              <select
                aria-label="Year to"
                value={filters.yearTo ?? ''}
                onChange={(e) => updateFilters({ yearTo: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            {active && (
              <button type="button" className="chip chip-reset" onClick={() => updateFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            )}
          </div>

          {genres.length > 0 && (
            <div className="chip-group chip-scroll" role="group" aria-label="Genre">
              {genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`chip glass${filters.genreId === g.id ? ' on' : ''}`}
                  aria-pressed={filters.genreId === g.id}
                  onClick={() => updateFilters({ genreId: filters.genreId === g.id ? null : g.id })}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="search-results" aria-busy={status === 'loading'}>
        <h1 className="search-title">{heading}</h1>

        {status === 'error' && items.length === 0 ? (
          <div className="search-state glass" role="alert">
            <p>We couldn’t load results.</p>
            {error && <p className="muted">{error}</p>}
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="search-state glass" role="status">
            <p>{query ? `No titles match “${query}”.` : 'No titles match these filters.'}</p>
            <p className="muted">Try a different spelling or loosen the filters.</p>
            {active && (
              <Button variant="ghost" onClick={() => updateFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="search-grid" role="list" aria-label="Search results">
            {items.map((m, i) => (
              <div role="listitem" key={`${m.mediaType}-${m.id}`}>
                <MovieCard movie={m} delay={(i % 20) * 30} onSelect={select} />
              </div>
            ))}
            {initialLoading &&
              Array.from({ length: 12 }, (_, i) => <Skeleton key={`sk-${i}`} variant="card" className="search-skeleton" />)}
          </div>
        )}

        {status === 'error' && items.length > 0 && (
          <div className="search-state glass" role="alert">
            <p>Couldn’t load more results.</p>
            <Button variant="primary" size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        )}

        {status === 'loading' && items.length > 0 && (
          <p className="search-more muted" role="status">
            Loading more…
          </p>
        )}

        {hasMore && status === 'ready' && (
          <div ref={sentinelRef} className="search-sentinel" data-testid="search-sentinel">
            {!hasIO && (
              <Button variant="ghost" onClick={loadMore}>
                Load more
              </Button>
            )}
          </div>
        )}
      </section>

      {selected && <DetailModal movie={selected} onClose={closeModal} />}
    </main>
  );
}
