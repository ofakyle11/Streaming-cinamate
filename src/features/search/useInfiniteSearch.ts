import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tmdb as defaultTmdb, toMovie } from '../../services';
import type {
  Movie,
  TmdbGenre,
  TmdbPage,
  TmdbSearchFilters,
  TmdbService,
  TmdbTitle,
} from '../../services/types';
import { applyFilters, searchKey, type SearchFilters } from './filters';

export interface SearchPageResult {
  results: TmdbTitle[];
  page: number;
  totalPages: number;
  totalResults: number;
}

const opt = <T>(v: T | null): T | undefined => (v == null ? undefined : v);

/** Filters that TMDB `/search` can apply server-side. Year only when a single year is selected. */
export function toSearchFilters(f: SearchFilters): TmdbSearchFilters {
  const out: TmdbSearchFilters = {};
  if (f.type) out.mediaType = f.type;
  if (f.genreId != null) out.genreId = f.genreId;
  if (f.minRating != null) out.minRating = f.minRating;
  if (f.yearFrom != null && f.yearFrom === f.yearTo) out.year = f.yearFrom;
  return out;
}

const popularityOf = (t: TmdbTitle) => t.popularity ?? t.vote_average;

/**
 * Merge two popularity-sorted pages into one, highest popularity first.
 * Stable: ties keep `a` before `b`.
 */
export function mergeByPopularity(a: readonly TmdbTitle[], b: readonly TmdbTitle[]): TmdbTitle[] {
  const out: TmdbTitle[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (popularityOf(b[j]) > popularityOf(a[i])) out.push(b[j++]);
    else out.push(a[i++]);
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

/** Results of a page response, or [] when the adapter clamped / overran the requested page. */
const pageResults = (res: TmdbPage<TmdbTitle>, page: number): TmdbTitle[] =>
  res.page === page && page <= res.total_pages ? res.results : [];

/**
 * Fetch one page for a query + filters.
 * - Non-empty query: `tmdb.search` with type/genre/rating (and a single year) pushed down.
 * - Empty query: `tmdb.discover` with every filter pushed down. With no type selected,
 *   the movie and TV discover pages are merged by popularity so live matches the mock.
 * Client-side filters are still applied as a safety net.
 */
export async function fetchSearchPage(
  svc: TmdbService,
  q: string,
  f: SearchFilters,
  page: number,
): Promise<SearchPageResult> {
  const query = q.trim();
  let res: TmdbPage<TmdbTitle>;
  if (query) {
    res = await svc.search(query, page, toSearchFilters(f));
  } else {
    const opts = {
      genreId: opt(f.genreId),
      yearFrom: opt(f.yearFrom),
      yearTo: opt(f.yearTo),
      minRating: opt(f.minRating),
      page,
    };
    if (f.type) {
      res = await svc.discover({ ...opts, mediaType: f.type });
    } else {
      const [movies, tv] = await Promise.all([
        svc.discover({ ...opts, mediaType: 'movie', sortBy: 'popularity' }),
        svc.discover({ ...opts, mediaType: 'tv', sortBy: 'popularity' }),
      ]);
      res = {
        page,
        results: mergeByPopularity(pageResults(movies, page), pageResults(tv, page)),
        total_pages: Math.max(movies.total_pages, tv.total_pages),
        total_results: movies.total_results + tv.total_results,
      };
    }
  }
  return {
    results: applyFilters(res.results, f),
    page: res.page,
    totalPages: res.total_pages,
    totalResults: res.total_results,
  };
}

/** A page with fewer (filtered) items than this triggers an automatic next-page fetch. */
export const AUTO_FILL_MIN_ITEMS = 8;
/** Max extra pages fetched automatically per load trigger. */
export const AUTO_FILL_MAX_EXTRA_PAGES = 3;

export type SearchStatus = 'loading' | 'ready' | 'error';

interface State {
  key: string;
  items: Movie[];
  page: number;
  totalPages: number;
  status: SearchStatus;
  error: string | null;
}

const fresh = (key: string): State => ({
  key,
  items: [],
  page: 0,
  totalPages: 1,
  status: 'loading',
  error: null,
});

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
export function useInfiniteSearch(
  q: string,
  filters: SearchFilters,
  svc: TmdbService = defaultTmdb,
): InfiniteSearch {
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

  const load = useCallback((firstPage: number) => {
    const run = (page: number, extra: number) => {
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
            const added = res.results
              .map((t) => toMovie(t, genres, service))
              .filter((m) => !seen.has(itemKey(m)));
            return {
              key: k,
              items: page === 1 ? added : [...base.items, ...added],
              page: res.page,
              totalPages: res.totalPages,
              status: 'ready',
              error: null,
            };
          });
          // Sparse page (filters removed most results): keep going so the grid never stalls.
          if (
            res.results.length < AUTO_FILL_MIN_ITEMS &&
            res.page < res.totalPages &&
            extra < AUTO_FILL_MAX_EXTRA_PAGES
          ) {
            run(res.page + 1, extra + 1);
          }
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
    };
    run(firstPage, 0);
  }, []);

  // Every load bumps reqRef, so responses for a previous key are discarded.
  useEffect(() => {
    load(1);
  }, [key, load]);

  const hasMore = state.status !== 'error' && state.page > 0 && state.page < state.totalPages;

  const loadMore = useCallback(() => {
    if (inFlightRef.current || state.status !== 'ready' || state.key !== argsRef.current.key)
      return;
    if (state.page >= state.totalPages) return;
    load(state.page + 1);
  }, [load, state.status, state.key, state.page, state.totalPages]);

  const retry = useCallback(() => {
    load(Math.max(1, state.page + 1));
  }, [load, state.page]);

  return useMemo(
    () => ({
      items: state.items,
      status: state.status,
      error: state.error,
      hasMore,
      loadMore,
      retry,
    }),
    [state.items, state.status, state.error, hasMore, loadMore, retry],
  );
}
