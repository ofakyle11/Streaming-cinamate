import { useEffect, useMemo, useState } from 'react';
import { tmdb as defaultTmdb, toMovie, type MediaType, type Movie, type TmdbGenre, type TmdbService } from '../services';
import type { WatchlistEntry } from '../state/store';
import { useWatchlist } from './useWatchlist';

export type MyListSort = 'added' | 'title' | 'year';

export const MY_LIST_SORTS: ReadonlyArray<{ value: MyListSort; label: string }> = [
  { value: 'added', label: 'Recently added' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'year', label: 'Newest release' },
];

/** Cache key for a watchlist entry. Legacy entries without a media type share the `?` bucket. */
export const entryKey = (e: Pick<WatchlistEntry, 'titleId' | 'mediaType'>) => `${e.mediaType ?? '?'}:${e.titleId}`;

/** Resolves one entry to a UI Movie. Entries saved without a media type try movie, then series. */
export async function resolveEntry(
  entry: WatchlistEntry,
  genres: readonly TmdbGenre[],
  svc: TmdbService,
): Promise<Movie | null> {
  const types: MediaType[] = entry.mediaType ? [entry.mediaType] : ['movie', 'tv'];
  for (const type of types) {
    const raw = await svc.details(type, entry.titleId);
    if (raw) return toMovie(raw, genres, svc);
  }
  return null;
}

/** Orders resolved titles. `added` keeps the store's newest-first order. */
export function sortMyList(items: readonly Movie[], sort: MyListSort): Movie[] {
  if (sort === 'title') return [...items].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'year') return [...items].sort((a, b) => b.year - a.year);
  return [...items];
}

export type MyListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: Movie[]; missing: WatchlistEntry[] };

type Resolved = Map<string, Movie | null>;

/**
 * The active profile's My List as UI Movies, in newest-first order. Resolved titles
 * are kept across list changes, so removing an item never refetches the rest.
 */
export function useMyListTitles(svc: TmdbService = defaultTmdb): { state: MyListState; retry: () => void } {
  const entries = useWatchlist();
  const [resolved, setResolved] = useState<{ svc: TmdbService; map: Resolved }>(() => ({ svc, map: new Map() }));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cache = resolved.svc === svc ? resolved.map : null;

  const pending = useMemo(
    () => entries.filter((e) => !cache?.has(entryKey(e))),
    [entries, cache],
  );
  const pendingKey = pending.map(entryKey).join(',');

  useEffect(() => {
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      const genres = await svc.genres();
      const results = await Promise.all(
        pending.map(async (e) => [entryKey(e), await resolveEntry(e, genres, svc)] as const),
      );
      if (cancelled) return;
      setResolved((prev) => {
        const map = new Map(prev.svc === svc ? prev.map : undefined);
        for (const [k, m] of results) map.set(k, m);
        return { svc, map };
      });
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load My List.');
    });
    return () => {
      cancelled = true;
    };
    // `pending` is derived from `pendingKey`; keying on the string avoids refetching on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, svc, attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  if (error) return { state: { status: 'error', message: error }, retry };
  if (pending.length) return { state: { status: 'loading' }, retry };

  const items: Movie[] = [];
  const missing: WatchlistEntry[] = [];
  for (const e of entries) {
    const m = cache?.get(entryKey(e));
    if (m) items.push(m);
    else missing.push(e);
  }
  return { state: { status: 'ready', items, missing }, retry };
}
