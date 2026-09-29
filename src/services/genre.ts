/**
 * Genre browse data helpers. Pure functions over a TmdbService so they work on
 * the mock adapter (no env vars) and the live one alike.
 */
import { tmdb, toMovie } from './index';
import type { DiscoverSort, Movie, TmdbGenre, TmdbService } from './types';
import { DEFAULT_DISCOVER_SORT, isDiscoverSort, sortTitles } from './tmdb/sort';

export interface GenreQuery {
  genreId: number | null;
  page: number;
  sortBy: DiscoverSort;
}

/** Parses the route param + search params of `/genre/:id?page=&sort=`. Never throws. */
export function parseGenreQuery(idParam: string | undefined, search: URLSearchParams): GenreQuery {
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : NaN;
  const rawPage = Number(search.get('page'));
  const sort = search.get('sort');
  return {
    genreId: Number.isSafeInteger(id) && id > 0 ? id : null,
    page: Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1,
    sortBy: isDiscoverSort(sort) ? sort : DEFAULT_DISCOVER_SORT,
  };
}

/** Builds search params for a genre page, omitting defaults to keep URLs clean. */
export function genreSearch(page: number, sortBy: DiscoverSort): string {
  const q = new URLSearchParams();
  if (sortBy !== DEFAULT_DISCOVER_SORT) q.set('sort', sortBy);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export interface GenrePageData {
  genre: TmdbGenre | null;
  items: Movie[];
  page: number;
  totalPages: number;
  totalResults: number;
}

/**
 * Loads one page of a genre. Passes `sortBy` to the adapter (server-side order
 * across pages) and also re-sorts the page client-side, so an adapter that
 * ignores the param still renders in the requested order.
 */
export async function loadGenrePage(
  genreId: number,
  page: number,
  sortBy: DiscoverSort,
  svc: TmdbService = tmdb,
): Promise<GenrePageData> {
  const genres = await svc.genres();
  const genre = genres.find((g) => g.id === genreId) ?? null;
  if (!genre) return { genre: null, items: [], page: 1, totalPages: 0, totalResults: 0 };
  const res = await svc.discover({ genreId, page, sortBy });
  return {
    genre,
    items: sortTitles(res.results, sortBy).map((t) => toMovie(t, genres, svc)),
    page: res.page,
    totalPages: res.total_pages,
    totalResults: res.total_results,
  };
}
