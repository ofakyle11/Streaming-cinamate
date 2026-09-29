/**
 * Genre browse data helpers. Pure functions over a TmdbService so they work on
 * the mock adapter (no env vars) and the live one alike.
 */
import { tmdb, toMovie } from './index';
import type { DiscoverSort, MediaType, Movie, TmdbGenre, TmdbService } from './types';
import { DEFAULT_DISCOVER_SORT, isDiscoverSort, sortTitles } from './tmdb/sort';

export interface GenreQuery {
  genreId: number | null;
  page: number;
  sortBy: DiscoverSort;
  /** Explicit media type from `?type=`; undefined means "the genre's default type". */
  type?: MediaType;
}

const isMediaType = (v: unknown): v is MediaType => v === 'movie' || v === 'tv';

/** Parses the route param + search params of `/genre/:id?page=&sort=&type=`. Never throws. */
export function parseGenreQuery(idParam: string | undefined, search: URLSearchParams): GenreQuery {
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : NaN;
  const rawPage = Number(search.get('page'));
  const sort = search.get('sort');
  const type = search.get('type');
  return {
    genreId: Number.isSafeInteger(id) && id > 0 ? id : null,
    page: Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1,
    sortBy: isDiscoverSort(sort) ? sort : DEFAULT_DISCOVER_SORT,
    type: isMediaType(type) ? type : undefined,
  };
}

/**
 * Builds search params for a genre page, omitting defaults to keep URLs clean.
 * `type` is dropped when absent or equal to `defaultType` (the genre's default).
 */
export function genreSearch(page: number, sortBy: DiscoverSort, type?: MediaType, defaultType?: MediaType): string {
  const q = new URLSearchParams();
  if (sortBy !== DEFAULT_DISCOVER_SORT) q.set('sort', sortBy);
  if (type && type !== defaultType) q.set('type', type);
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
  /** Media type the items were loaded for. */
  mediaType: MediaType;
  /** The genre's default type: movie when the movie list has it, else tv. */
  defaultType: MediaType;
  /** Media types whose genre list contains this genre (movie first). Empty when not found. */
  availableTypes: MediaType[];
}

/**
 * Which media types list a genre. TMDB keeps separate movie and TV genre lists
 * (e.g. 10765 "Sci-Fi & Fantasy" is TV-only), so discover must use a type the
 * genre actually belongs to.
 */
export async function genreMediaTypes(genreId: number, svc: TmdbService = tmdb): Promise<MediaType[]> {
  const [movie, tv] = await Promise.all([svc.genres('movie'), svc.genres('tv')]);
  const types: MediaType[] = [];
  if (movie.some((g) => g.id === genreId)) types.push('movie');
  if (tv.some((g) => g.id === genreId)) types.push('tv');
  return types;
}

/**
 * Loads one page of a genre. Passes `sortBy` to the adapter (server-side order
 * across pages) and also re-sorts the page client-side, so an adapter that
 * ignores the param still renders in the requested order.
 *
 * `type` picks movie or TV titles. When omitted, or not available for this
 * genre, the genre's default type is used: movie if the movie genre list has
 * it (including shared genres), tv if only the TV list does.
 */
export async function loadGenrePage(
  genreId: number,
  page: number,
  sortBy: DiscoverSort,
  svc: TmdbService = tmdb,
  type?: MediaType,
): Promise<GenrePageData> {
  const genres = await svc.genres();
  const genre = genres.find((g) => g.id === genreId) ?? null;
  if (!genre) {
    return {
      genre: null,
      items: [],
      page: 1,
      totalPages: 0,
      totalResults: 0,
      mediaType: 'movie',
      defaultType: 'movie',
      availableTypes: [],
    };
  }
  const found = await genreMediaTypes(genreId, svc);
  // In the merged list but neither per-type list (odd adapter): treat as movie.
  const availableTypes: MediaType[] = found.length ? found : ['movie'];
  const defaultType = availableTypes[0];
  const mediaType = type && availableTypes.includes(type) ? type : defaultType;
  const res = await svc.discover({ mediaType, genreId, page, sortBy });
  return {
    genre,
    items: sortTitles(res.results, sortBy).map((t) => toMovie(t, genres, svc)),
    page: res.page,
    totalPages: res.total_pages,
    totalResults: res.total_results,
    mediaType,
    defaultType,
    availableTypes,
  };
}
