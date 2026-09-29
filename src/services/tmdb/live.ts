import type {
  DiscoverSort,
  MediaType,
  TmdbGenre,
  TmdbImageSize,
  TmdbPage,
  TmdbRawDetails,
  TmdbRawListItem,
  TmdbRawPage,
  TmdbSearchFilters,
  TmdbService,
  TmdbTitle,
  TmdbTitleDetails,
  TmdbTrendingOptions,
  TmdbVideo,
} from '../types';
import { toTmdbSortParam } from './sort';

/**
 * Builds the proxy path for a `/discover` call. The proxy forwards query params
 * to TMDB and injects the API key server-side.
 */
export function buildDiscoverPath(opts: {
  mediaType?: MediaType;
  genreId?: number;
  page?: number;
  sortBy?: DiscoverSort;
}): string {
  const type = opts.mediaType ?? 'movie';
  const q = new URLSearchParams();
  if (opts.genreId != null) q.set('with_genres', String(opts.genreId));
  q.set('page', String(Math.max(1, Math.floor(opts.page ?? 1))));
  if (opts.sortBy) q.set('sort_by', toTmdbSortParam(opts.sortBy, type));
  return `/discover/${type}?${q.toString()}`;
}

/**
 * Live TMDB adapter. Talks to OUR proxy (VITE_TMDB_PROXY), never to TMDB directly,
 * so the TMDB API key stays server-side.
 *
 * Proxy contract (shared with netlify/functions/tmdb.ts):
 *   GET `${base}?path=<tmdb v3 path>&<tmdb query params>`
 * The function forwards `path` + the remaining params to https://api.themoviedb.org/3
 * and returns TMDB's JSON body and status unchanged.
 */

export const DEFAULT_TMDB_PROXY = '/.netlify/functions/tmdb';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

/** TMDB-supported sizes per image kind (from /configuration). */
export const TMDB_IMAGE_SIZES = {
  poster: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
  backdrop: ['w300', 'w780', 'w1280', 'original'],
  profile: ['w185', 'h632', 'original'],
  logo: ['w92', 'w154', 'w185', 'w300', 'w500', 'original'],
} as const satisfies Record<string, readonly TmdbImageSize[]>;

export const DETAILS_APPEND = 'credits,videos,similar,recommendations,watch/providers';

/**
 * Resolve a TMDB `*_path` to a full image URL. Returns '' for a missing path so
 * callers can render a placeholder. Absolute URLs pass through untouched.
 */
export function tmdbImageUrl(
  path: string | null | undefined,
  size: TmdbImageSize = 'w500',
): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${TMDB_IMAGE_BASE}${size}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Build a `srcset` string for width-based sizes (height-based / original are skipped). */
export function tmdbSrcSet(
  path: string | null | undefined,
  sizes: readonly TmdbImageSize[],
): string {
  if (!path) return '';
  return sizes
    .filter((s) => /^w\d+$/.test(s))
    .map((s) => `${tmdbImageUrl(path, s)} ${s.slice(1)}w`)
    .join(', ');
}

export class TmdbHttpError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(status: number, path: string) {
    super(`TMDB proxy request failed (${status}) for ${path}`);
    this.name = 'TmdbHttpError';
    this.status = status;
    this.path = path;
  }
}

type QueryValue = string | number | boolean | undefined | null;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** `${base}?path=<path>&k=v...` — undefined/null/'' params are dropped. */
export function buildProxyUrl(
  base: string,
  path: string,
  query: Record<string, QueryValue> = {},
): string {
  const params = new URLSearchParams();
  params.set('path', path.startsWith('/') ? path : `/${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

/* ------------------------------------------------------------ normalisation */

function isMediaType(v: unknown): v is MediaType {
  return v === 'movie' || v === 'tv';
}

/** Raw TMDB list item -> TmdbTitle. TV `name` / `first_air_date` are folded into the shared shape. */
export function normalizeTitle(raw: TmdbRawListItem, fallbackType: MediaType): TmdbTitle {
  const mediaType = isMediaType(raw.media_type) ? raw.media_type : fallbackType;
  const display = raw.title ?? raw.name ?? '';
  const t: TmdbTitle = {
    id: raw.id,
    media_type: mediaType,
    overview: raw.overview ?? '',
    poster_path: raw.poster_path ?? '',
    backdrop_path: raw.backdrop_path ?? '',
    genre_ids: raw.genre_ids ?? [],
    vote_average: typeof raw.vote_average === 'number' ? raw.vote_average : 0,
    release_date: raw.release_date || raw.first_air_date || '',
    runtime: 0,
  };
  if (typeof raw.popularity === 'number') t.popularity = raw.popularity;
  if (mediaType === 'tv') t.name = raw.name ?? display;
  else t.title = raw.title ?? display;
  return t;
}

function normalizeResults(
  results: TmdbRawListItem[] | undefined,
  fallbackType: MediaType,
): TmdbTitle[] {
  return (results ?? [])
    .filter((r) => r && typeof r.id === 'number' && r.media_type !== 'person')
    .map((r) => normalizeTitle(r, fallbackType));
}

/**
 * TMDB rejects `page` above 500 on /discover, /search and the list endpoints
 * (HTTP 400/422), even though `total_pages` often reports thousands.
 */
export const TMDB_MAX_PAGE = 500;

/** Clamp a requested page to TMDB's valid range 1..TMDB_MAX_PAGE (non-finite -> 1). */
export function clampTmdbPage(page: number | undefined | null): number {
  const n = Math.floor(Number(page));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, TMDB_MAX_PAGE);
}

/**
 * Raw page -> TmdbPage. `total_pages` is clamped to 1..TMDB_MAX_PAGE so pagers
 * (useInfiniteSearch hasMore, GenrePage "Next") never request an unreachable page.
 * `total_results` is left as TMDB reports it: it is only shown as a count
 * ("N titles"), the true catalogue size is the more honest number, and no code
 * derives page numbers from it.
 */
export function normalizePage(raw: TmdbRawPage, fallbackType: MediaType): TmdbPage<TmdbTitle> {
  const results = normalizeResults(raw.results, fallbackType);
  return {
    page: raw.page ?? 1,
    results,
    total_pages: clampTmdbPage(raw.total_pages ?? 1),
    total_results: raw.total_results ?? results.length,
  };
}

export function normalizeDetails(raw: TmdbRawDetails, mediaType: MediaType): TmdbTitleDetails {
  const base = normalizeTitle({ ...raw, media_type: mediaType }, mediaType);
  const genres = raw.genres ?? [];
  const runtime = raw.runtime ?? raw.episode_run_time?.find((n) => n > 0) ?? 0;
  const d: TmdbTitleDetails = {
    ...base,
    genre_ids: base.genre_ids.length ? base.genre_ids : genres.map((g) => g.id),
    runtime,
    genres,
  };
  if (raw.tagline) d.tagline = raw.tagline;
  if (raw.status) d.status = raw.status;
  if (raw.original_language) d.original_language = raw.original_language;
  if (raw.number_of_seasons != null) d.number_of_seasons = raw.number_of_seasons;
  if (raw.number_of_episodes != null) d.number_of_episodes = raw.number_of_episodes;
  if (raw.credits) {
    d.credits = {
      cast: (raw.credits.cast ?? []).map((c, i) => ({
        id: c.id,
        name: c.name ?? '',
        character: c.character ?? '',
        profile_path: c.profile_path ?? '',
        order: c.order ?? i,
      })),
      crew: (raw.credits.crew ?? []).map((c) => ({
        id: c.id,
        name: c.name ?? '',
        job: c.job ?? '',
        department: c.department ?? '',
        profile_path: c.profile_path ?? '',
      })),
    };
  }
  if (raw.videos) {
    d.videos = (raw.videos.results ?? [])
      .filter(
        (v): v is Partial<TmdbVideo> & { key: string } => typeof v.key === 'string' && v.key !== '',
      )
      .map((v) => ({
        id: v.id ?? v.key,
        key: v.key,
        name: v.name ?? '',
        site: v.site ?? '',
        type: v.type ?? '',
        official: Boolean(v.official),
      }));
  }
  if (raw.similar) d.similar = normalizeResults(raw.similar.results, mediaType);
  if (raw.recommendations)
    d.recommendations = normalizeResults(raw.recommendations.results, mediaType);
  const providers = raw['watch/providers'];
  if (providers) d.watchProviders = providers.results ?? {};
  return d;
}

function mergeGenres(...lists: TmdbGenre[][]): TmdbGenre[] {
  const seen = new Map<number, TmdbGenre>();
  for (const list of lists) for (const g of list) if (!seen.has(g.id)) seen.set(g.id, g);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function applyFilters(page: TmdbPage<TmdbTitle>, filters: TmdbSearchFilters): TmdbPage<TmdbTitle> {
  const { genreId, minRating } = filters;
  if (genreId == null && minRating == null) return page;
  const results = page.results.filter(
    (t) =>
      (genreId == null || t.genre_ids.includes(genreId)) &&
      (minRating == null || t.vote_average >= minRating),
  );
  return { ...page, results };
}

/** Minimum vote count required when a rating floor is set, so 1-vote 10/10s don't flood results. */
export const DISCOVER_MIN_VOTE_COUNT = 50;

/**
 * TMDB `/discover` params for year range + rating floor. Movies filter on
 * `primary_release_date`, TV on `first_air_date`.
 */
export function discoverFilterParams(
  mediaType: MediaType,
  { yearFrom, yearTo, minRating }: { yearFrom?: number; yearTo?: number; minRating?: number },
): Record<string, QueryValue> {
  const field = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
  const out: Record<string, QueryValue> = {};
  if (yearFrom != null) out[`${field}.gte`] = `${yearFrom}-01-01`;
  if (yearTo != null) out[`${field}.lte`] = `${yearTo}-12-31`;
  if (minRating != null) {
    out['vote_average.gte'] = minRating;
    out['vote_count.gte'] = DISCOVER_MIN_VOTE_COUNT;
  }
  return out;
}

/* ------------------------------------------------------------------ adapter */

export interface LiveTmdbOptions {
  /** Injectable fetch (tests). Defaults to the global fetch. */
  fetch?: FetchLike;
}

export function createLiveTmdb(
  proxyUrl: string = DEFAULT_TMDB_PROXY,
  opts: LiveTmdbOptions = {},
): TmdbService {
  const base = (proxyUrl.trim() || DEFAULT_TMDB_PROXY).replace(/\/+$/, '');
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  const genreCache = new Map<MediaType, Promise<TmdbGenre[]>>();

  async function get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    const res = await doFetch(buildProxyUrl(base, path, query), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new TmdbHttpError(res.status, path);
    return (await res.json()) as T;
  }

  const list = async (path: string, fallbackType: MediaType, query?: Record<string, QueryValue>) =>
    normalizePage(await get<TmdbRawPage>(path, query), fallbackType);

  function genreList(mediaType: MediaType): Promise<TmdbGenre[]> {
    let p = genreCache.get(mediaType);
    if (!p) {
      p = get<{ genres?: TmdbGenre[] }>(`/genre/${mediaType}/list`).then((r) => r.genres ?? []);
      // Don't cache failures.
      p.catch(() => genreCache.delete(mediaType));
      genreCache.set(mediaType, p);
    }
    return p;
  }

  const discover: TmdbService['discover'] = ({
    mediaType = 'movie',
    genreId,
    page = 1,
    sortBy,
    yearFrom,
    yearTo,
    minRating,
  } = {}) =>
    list(`/discover/${mediaType}`, mediaType, {
      page: clampTmdbPage(page),
      with_genres: genreId,
      sort_by: sortBy ? toTmdbSortParam(sortBy, mediaType) : 'popularity.desc',
      include_adult: false,
      ...discoverFilterParams(mediaType, { yearFrom, yearTo, minRating }),
    });

  return {
    trending(page = 1, { mediaType = 'all', window = 'day' }: TmdbTrendingOptions = {}) {
      return list(`/trending/${mediaType}/${window}`, mediaType === 'tv' ? 'tv' : 'movie', {
        page: clampTmdbPage(page),
      });
    },
    popular(mediaType, page = 1) {
      return list(`/${mediaType}/popular`, mediaType, { page: clampTmdbPage(page) });
    },
    topRated(mediaType, page = 1) {
      return list(`/${mediaType}/top_rated`, mediaType, { page: clampTmdbPage(page) });
    },
    nowPlaying(page = 1) {
      return list('/movie/now_playing', 'movie', { page: clampTmdbPage(page) });
    },
    upcoming(page = 1) {
      return list('/movie/upcoming', 'movie', { page: clampTmdbPage(page) });
    },
    discover,
    byGenre(genreId, { mediaType = 'movie', page = 1 } = {}) {
      return discover({ mediaType, genreId, page: clampTmdbPage(page) });
    },
    async search(query, page = 1, filters: TmdbSearchFilters = {}) {
      const q = query.trim();
      if (!q) return { page: 1, results: [], total_pages: 1, total_results: 0 };
      const { mediaType, year } = filters;
      const endpoint = mediaType ? `/search/${mediaType}` : '/search/multi';
      const yearParam =
        year == null
          ? {}
          : mediaType === 'tv'
            ? { first_air_date_year: year }
            : mediaType === 'movie'
              ? { year }
              : {};
      let result = await list(endpoint, mediaType ?? 'movie', {
        query: q,
        page: clampTmdbPage(page),
        include_adult: false,
        ...yearParam,
      });
      if (year != null && !mediaType) {
        // /search/multi has no year param; filter the page client-side.
        result = {
          ...result,
          results: result.results.filter((t) => t.release_date.startsWith(String(year))),
        };
      }
      return applyFilters(result, filters);
    },
    async details(mediaType, id) {
      try {
        const raw = await get<TmdbRawDetails>(`/${mediaType}/${id}`, {
          append_to_response: DETAILS_APPEND,
        });
        return normalizeDetails(raw, mediaType);
      } catch (err) {
        if (err instanceof TmdbHttpError && err.status === 404) return null;
        throw err;
      }
    },
    async genres(mediaType) {
      if (mediaType) return genreList(mediaType);
      const [movie, tv] = await Promise.all([genreList('movie'), genreList('tv')]);
      return mergeGenres(movie, tv);
    },
    imageUrl(path: string, size: TmdbImageSize = 'w500') {
      return tmdbImageUrl(path, size);
    },
  };
}
