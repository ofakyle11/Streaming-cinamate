import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tmdb, toMovie } from '../services';
import type { Movie, TmdbGenre, TmdbService } from '../services/types';
import { HERO_COUNT, HERO_ROW_ID, HOME_ROWS, uniqueTitles, type HomeRowSpec } from '../pages/homeRows';
import { withRetry } from '../services/retry';

export type HomeRowState =
  | { status: 'loading' }
  | { status: 'ready'; items: Movie[] }
  | { status: 'error'; message: string };

export interface HomeRowView {
  id: string;
  title: string;
  state: HomeRowState;
}

export interface UseHomeRows {
  rows: HomeRowView[];
  /** Hero features once the hero row is ready; null while loading or failed. */
  featured: Movie[] | null;
  heroStatus: HomeRowState['status'];
  /** True when every row failed (show a page-level error). */
  allFailed: boolean;
  retry(id: string): void;
  retryAll(): void;
}

const LOADING: HomeRowState = { status: 'loading' };

const initialState = (specs: readonly HomeRowSpec[]) =>
  Object.fromEntries(specs.map((s) => [s.id, LOADING])) as Record<string, HomeRowState>;

const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong.');

/**
 * Loads each Home row independently from the TMDB service (mock or live), so
 * one failing row shows its own error + retry without blanking the page.
 */
export function useHomeRows(svc: TmdbService = tmdb, specs: readonly HomeRowSpec[] = HOME_ROWS): UseHomeRows {
  const [state, setState] = useState<Record<string, HomeRowState>>(() => initialState(specs));
  const alive = useRef(false);
  const tokens = useRef<Record<string, number>>({});
  const genresRef = useRef<Promise<TmdbGenre[]> | null>(null);

  const getGenres = useCallback(() => {
    if (!genresRef.current) {
      const p = svc.genres();
      genresRef.current = p;
      // Don't cache a failure: the next retry should ask again.
      p.catch(() => {
        if (genresRef.current === p) genresRef.current = null;
      });
    }
    return genresRef.current;
  }, [svc]);

  /** Fetches one row; only touches state after the await, and ignores stale responses. */
  const fetchRow = useCallback(
    async (spec: HomeRowSpec) => {
      const token = (tokens.current[spec.id] ?? 0) + 1;
      tokens.current[spec.id] = token;
      let next: HomeRowState;
      try {
        // Transient failures (network drop, 429/5xx) retry with backoff before the row shows an error.
        const [genres, page] = await withRetry(() => Promise.all([getGenres(), spec.load(svc)]), { maxAttempts: 3 });
        next = { status: 'ready', items: uniqueTitles(page.results.map((t) => toMovie(t, genres, svc))) };
      } catch (e) {
        next = { status: 'error', message: messageOf(e) };
      }
      if (!alive.current || tokens.current[spec.id] !== token) return;
      setState((s) => ({ ...s, [spec.id]: next }));
    },
    [getGenres, svc],
  );

  useEffect(() => {
    alive.current = true;
    specs.forEach((spec) => void fetchRow(spec));
    return () => {
      alive.current = false;
    };
  }, [fetchRow, specs]);

  const retry = useCallback(
    (id: string) => {
      const spec = specs.find((s) => s.id === id);
      if (!spec) return;
      setState((s) => ({ ...s, [id]: LOADING }));
      void fetchRow(spec);
    },
    [fetchRow, specs],
  );

  const retryAll = useCallback(() => {
    setState(initialState(specs));
    specs.forEach((spec) => void fetchRow(spec));
  }, [fetchRow, specs]);

  const rows = useMemo(
    () => specs.map((s) => ({ id: s.id, title: s.title, state: state[s.id] ?? LOADING })),
    [specs, state],
  );

  const hero = state[HERO_ROW_ID] ?? LOADING;
  const featured = hero.status === 'ready' && hero.items.length > 0 ? hero.items.slice(0, HERO_COUNT) : null;
  const allFailed = rows.length > 0 && rows.every((r) => r.state.status === 'error');

  return { rows, featured, heroStatus: hero.status, allFailed, retry, retryAll };
}
