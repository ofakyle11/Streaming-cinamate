/**
 * Search filters: URL <-> state mapping and client-side filtering.
 * Filters are applied client-side on top of `tmdb.search` / `tmdb.discover`
 * results so they work identically with the mock and live adapters.
 */
import type { MediaType, TmdbTitle } from '../../services/types';

export interface SearchFilters {
  type: MediaType | null;
  genreId: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  minRating: number | null;
}

export const EMPTY_FILTERS: SearchFilters = {
  type: null,
  genreId: null,
  yearFrom: null,
  yearTo: null,
  minRating: null,
};

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
export const RATING_STEPS = [6, 7, 8, 9] as const;

const KEYS = { type: 'type', genreId: 'genre', yearFrom: 'from', yearTo: 'to', minRating: 'rating' } as const;

function intParam(v: string | null, min: number, max: number): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i < min || i > max ? null : i;
}

function numParam(v: string | null, min: number, max: number): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Parse (and sanitise) filters from URL search params. Invalid values are dropped. */
export function parseFilters(params: URLSearchParams): SearchFilters {
  const rawType = params.get(KEYS.type);
  const type: MediaType | null = rawType === 'movie' || rawType === 'tv' ? rawType : null;
  let yearFrom = intParam(params.get(KEYS.yearFrom), MIN_YEAR, MAX_YEAR);
  let yearTo = intParam(params.get(KEYS.yearTo), MIN_YEAR, MAX_YEAR);
  if (yearFrom != null && yearTo != null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  return {
    type,
    genreId: intParam(params.get(KEYS.genreId), 1, Number.MAX_SAFE_INTEGER),
    yearFrom,
    yearTo,
    minRating: numParam(params.get(KEYS.minRating), 0, 10),
  };
}

/**
 * Write filters into a copy of `base` (other params such as `q` are preserved).
 * Null filters remove their key so URLs stay short.
 */
export function writeFilters(base: URLSearchParams, f: SearchFilters): URLSearchParams {
  const next = new URLSearchParams(base);
  const set = (k: string, v: string | number | null) => {
    if (v == null) next.delete(k);
    else next.set(k, String(v));
  };
  set(KEYS.type, f.type);
  set(KEYS.genreId, f.genreId);
  set(KEYS.yearFrom, f.yearFrom);
  set(KEYS.yearTo, f.yearTo);
  set(KEYS.minRating, f.minRating);
  return next;
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return f.type != null || f.genreId != null || f.yearFrom != null || f.yearTo != null || f.minRating != null;
}

export function titleYear(t: TmdbTitle): number | null {
  const y = Number(t.release_date?.slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** True when a title passes every active filter. */
export function matchesFilters(t: TmdbTitle, f: SearchFilters): boolean {
  if (f.type && t.media_type !== f.type) return false;
  if (f.genreId != null && !t.genre_ids.includes(f.genreId)) return false;
  if (f.minRating != null && t.vote_average < f.minRating) return false;
  if (f.yearFrom != null || f.yearTo != null) {
    const y = titleYear(t);
    if (y == null) return false;
    if (f.yearFrom != null && y < f.yearFrom) return false;
    if (f.yearTo != null && y > f.yearTo) return false;
  }
  return true;
}

export function applyFilters(items: readonly TmdbTitle[], f: SearchFilters): TmdbTitle[] {
  return items.filter((t) => matchesFilters(t, f));
}

/** Stable key for "the query changed, restart from page 1". */
export function searchKey(q: string, f: SearchFilters): string {
  return JSON.stringify([q.trim().toLowerCase(), f.type, f.genreId, f.yearFrom, f.yearTo, f.minRating]);
}
