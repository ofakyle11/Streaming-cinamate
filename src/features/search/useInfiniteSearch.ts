import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tmdb as defaultTmdb, toMovie } from '../../services';
import type { Movie, TmdbGenre, TmdbService, TmdbTitle } from '../../services/types';
import { applyFilters, searchKey, type SearchFilters } from './filters';

export interface SearchPageResult {
  results: TmdbTitle[];
  page: number;
  totalPages: number;
  totalResults: number;
}

/**
 * Fetch one page for a query + filters.
 * - Non-empty query: `tmdb.search` then client-side filters.
 * - Empty query: `tmdb.discover` (type/genre pushed down), remaining filters client-side.
 */
export async function fetchSearchPage(
  svc: TmdbService,
  q: string,
  f: SearchFilters,
  page: number,
): Promise<SearchPageResult> {
  const query = q.trim();
  const res = query
    ? await svc.search(query, page)
    : await svc.discover({ mediaType: f.type ?? undefined, genreId: f.genreId ?? undefined, page });
  return {
    results: applyFilters(res.results, f),
    page: res.page,
    totalPages: res.total_pages,
    totalResults: res.total_results,
  };
}

export type SearchStatus = 'loading' | 'ready' | 'error';

interface State {
  key: string;
  items: Movie[];
  page: number;
  totalPages: number;
  status: SearchStatus;
  error: string | null;
}

const fresh = (key: string): State => ({ key, items: [], page: 0, totalPages: 1, status: 'loading', error: null });

const itemKey = (m: Movie) => `${m.mediaType}-${m.id}`;

export interface InfiniteSearch {
  items: Movie[];
  status: SearchStatus;
  error: string | null;
  hasMore: boolean;
  /** Load the next page (no-op while loading or when exhausted). */
  loadMore: () => void;
  /** Retry the last failed request. */
  retry: () => void;
}

/** Paged search/discover with client-side filters and append-on-scroll. */
export function useInfiniteSearch(q: string, filters: SearchFilters, svc: TmdbService = defaultTmdb): InfiniteSearch {
  const key = searchKey(q, filters);
  const [stored, setState] = useState<State>(() => fresh(key));
  // Derived reset: a new query/filter set starts from an empty page-0 state.
  const state = stored.key === key ? stored : fresh(key);

  const genresRef = useRef<Promise<TmdbGenre[]> | null>(null);
  const reqRef = useRef(0);
  const inFlightRef = useRef<string | null>(null);
  const argsRef = useRef({ q, filters, svc, key });
  // Keep the latest args for async callbacks. Declared before the load effect so it runs first.
  useEffect(() => {
    argsRef.current = { q, filters, svc, key };
  });

  const load = useCallback((page: number) => {
    const { q: query, filters: f, svc: service, key: k } = argsRef.current;
    const id = ++reqRef.current;
    inFlightRef.current = `${k}#${page}`;
    setState((s) => ({ ...(s.key === k ? s : fresh(k)), status: 'loading', error: null }));
    if (!genresRef.current) {
      genresRef.current = service.genres().catch((e: unknown) => {
        genresRef.current = null;
        throw e;
      });
    }
    Promise.all([genresRef.current, fetchSearchPage(service, query, f, page)])
      .then(([genres, res]) => {
        if (id !== reqRef.current) return;
        inFlightRef.current = null;
        setState((s) => {
          const base = s.key === k ? s : fresh(k);
          const seen = new Set(base.items.map(itemKey));
          const added = res.results.map((t) => toMovie(t, genres, service)).filter((m) => !seen.has(itemKey(m)));
          return {
            key: k,
            items: page === 1 ? added : [...base.items, ...added],
            page: res.page,
            totalPages: res.totalPages,
            status: 'ready',
            error: null,
          };
        });
      })
      .catch((e: unknown) => {
        if (id !== reqRef.current) return;
        inFlightRef.current = null;
        setState((s) => ({
          ...(s.key === k ? s : fresh(k)),
          status: 'error',
          error: e instanceof Error ? e.message : 'Search failed.',
        }));
      });
  }, []);

  // Every load bumps reqRef, so responses for a previous key are discarded.
  useEffect(() => {
    load(1);
  }, [key, load]);

  const hasMore = state.status !== 'error' && state.page > 0 && state.page < state.totalPages;

  const loadMore = useCallback(() => {
    if (inFlightRef.current || state.status !== 'ready' || state.key !== argsRef.current.key) return;
    if (state.page >= state.totalPages) return;
    load(state.page + 1);
  }, [load, state.status, state.key, state.page, state.totalPages]);

  const retry = useCallback(() => {
    load(Math.max(1, state.page + 1));
  }, [load, state.page]);

  return useMemo(
    () => ({ items: state.items, status: state.status, error: state.error, hasMore, loadMore, retry }),
    [state.items, state.status, state.error, hasMore, loadMore, retry],
  );
}
