import type { MediaType, Movie } from '../services/types';

/**
 * "Viewed titles" history: a per-profile log of title-page opens and trailer
 * plays. Entries keep a small snapshot of the title so Home can render the
 * Continue Watching / Recently Viewed rows without refetching from TMDB.
 * Pure helpers only; the store (state/store.ts) persists the entries.
 */

export type ViewSource = 'open' | 'trailer';

/** The subset of Movie kept in history (enough to render a MovieCard). */
export type ViewedTitle = Pick<
  Movie,
  'id' | 'mediaType' | 'title' | 'year' | 'rating' | 'match' | 'genres' | 'poster' | 'backdrop' | 'runtime'
>;

export interface ViewEntry {
  /** `${mediaType}:${id}`; movie and TV ids can collide on TMDB. */
  key: string;
  title: ViewedTitle;
  /** First time this title was viewed (ms epoch). */
  firstViewedAt: number;
  /** Most recent open or trailer play (ms epoch). */
  lastViewedAt: number;
  /** Most recent trailer play (ms epoch); absent when the trailer was never played. */
  trailerPlayedAt?: number;
  /** How many times the title was opened or its trailer played. */
  views: number;
}

/** Oldest entries are dropped past this many per profile. */
export const VIEW_HISTORY_LIMIT = 50;
/** Max cards in each Home history row. */
export const HISTORY_ROW_LIMIT = 12;

export function viewKey(t: { mediaType: MediaType; id: number }): string {
  return `${t.mediaType}:${t.id}`;
}

/** Snapshot a Movie for history, dropping the (long) description. */
export function toViewedTitle(m: Movie | ViewedTitle): ViewedTitle {
  return {
    id: m.id,
    mediaType: m.mediaType,
    title: m.title,
    year: m.year,
    rating: m.rating,
    match: m.match,
    genres: [...m.genres],
    poster: m.poster,
    backdrop: m.backdrop,
    runtime: m.runtime,
  };
}

/** Rebuild a Movie view model (for MovieCard / Row) from a history entry. */
export function viewToMovie(e: ViewEntry): Movie {
  return { ...e.title, genres: [...e.title.genres], description: '' };
}

/**
 * Record a view: moves (or inserts) the title to the front, bumps timestamps
 * and the counter, and caps the list. Returns a new array.
 */
export function upsertView(
  list: readonly ViewEntry[],
  title: Movie | ViewedTitle,
  source: ViewSource,
  now: number = Date.now(),
  limit: number = VIEW_HISTORY_LIMIT,
): ViewEntry[] {
  const key = viewKey(title);
  const existing = list.find((e) => e.key === key);
  const entry: ViewEntry = {
    key,
    title: toViewedTitle(title),
    firstViewedAt: existing?.firstViewedAt ?? now,
    lastViewedAt: now,
    views: (existing?.views ?? 0) + 1,
  };
  const trailerPlayedAt = source === 'trailer' ? now : existing?.trailerPlayedAt;
  if (trailerPlayedAt !== undefined) entry.trailerPlayedAt = trailerPlayedAt;
  return [entry, ...list.filter((e) => e.key !== key)].slice(0, Math.max(0, limit));
}

export function removeView(list: readonly ViewEntry[], key: string): ViewEntry[] {
  return list.filter((e) => e.key !== key);
}

/** Minimal playback-history shape (state/store.ts HistoryEntry) used to merge progress in. */
export interface PlaybackLike {
  titleId: number;
  position: number;
  completed: boolean;
}

/**
 * Continue Watching: titles whose trailer was played, or that have in-progress
 * playback, excluding anything marked completed. Most recent activity first.
 */
export function continueWatching(
  views: readonly ViewEntry[],
  playback: readonly PlaybackLike[] = [],
  limit: number = HISTORY_ROW_LIMIT,
): ViewEntry[] {
  const inProgress = new Set(playback.filter((p) => !p.completed && p.position > 0).map((p) => p.titleId));
  const completed = new Set(playback.filter((p) => p.completed).map((p) => p.titleId));
  return views
    .filter((e) => !completed.has(e.title.id) && (e.trailerPlayedAt !== undefined || inProgress.has(e.title.id)))
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt)
    .slice(0, limit);
}

/** Recently Viewed: everything else in the log, most recent first (no duplicates of `exclude`). */
export function recentlyViewed(
  views: readonly ViewEntry[],
  exclude: readonly ViewEntry[] = [],
  limit: number = HISTORY_ROW_LIMIT,
): ViewEntry[] {
  const skip = new Set(exclude.map((e) => e.key));
  return views
    .filter((e) => !skip.has(e.key))
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt)
    .slice(0, limit);
}

/** Compact relative time: "just now", "5m ago", "3h ago", "2d ago", else a date. */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Defensive filter for persisted data (older builds / hand-edited storage). */
export function isViewEntry(v: unknown): v is ViewEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<ViewEntry>;
  const t = e.title as Partial<ViewedTitle> | undefined;
  return (
    typeof e.key === 'string' &&
    typeof e.lastViewedAt === 'number' &&
    !!t &&
    typeof t.id === 'number' &&
    (t.mediaType === 'movie' || t.mediaType === 'tv') &&
    typeof t.title === 'string' &&
    Array.isArray(t.genres)
  );
}
