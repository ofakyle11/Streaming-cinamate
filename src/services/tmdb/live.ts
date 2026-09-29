import type {
  MediaType,
  TmdbGenre,
  TmdbImageSize,
  TmdbPage,
  TmdbProvider,
  TmdbService,
  TmdbTitle,
  TmdbTitleDetails,
} from '../types';
import type {
  RawDetails,
  RawGenre,
  RawListItem,
  RawPage,
  RawWatchProvider,
  TmdbAnyImageSize,
} from './types';

/** Default proxy (Netlify function). It holds the TMDB key server-side. */
export const DEFAULT_TMDB_PROXY = '/.netlify/functions/tmdb';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const DETAILS_APPEND = 'credits,videos,similar,recommendations,watch/providers';

/** Build a TMDB image URL. Returns '' for a missing path so callers can show a placeholder. */
export function tmdbImageUrl(path: string | null | undefined, size: TmdbAnyImageSize = 'w500'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

export class TmdbHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(`TMDB proxy ${endpoint} failed with HTTP ${status}`);
    this.name = 'TmdbHttpError';
  }
}

type Query = Record<string, string | number | boolean | undefined>;

/** Normalise a raw TMDB list/detail record into our TmdbTitle shape. */
export function normalizeTitle(raw: RawListItem, fallbackType?: MediaType): TmdbTitle | null {
  const media_type = raw.media_type === 'movie' || raw.media_type === 'tv' ? raw.media_type : fallbackType;
  if (!media_type) return null; // people, or unknown
  return {
    id: raw.id,
    media_type,
    title: raw.title,
    name: raw.name,
    overview: raw.overview ?? '',
    poster_path: raw.poster_path ?? '',
    backdrop_path: raw.backdrop_path ?? '',
    genre_ids: raw.genre_ids ?? raw.genres?.map((g) => g.id) ?? [],
    vote_average: raw.vote_average ?? 0,
    release_date: raw.release_date ?? raw.first_air_date ?? '',
    runtime: raw.runtime ?? raw.episode_run_time?.[0] ?? 0,
  };
}

function normalizePage(raw: RawPage<RawListItem>, fallbackType?: MediaType): TmdbPage<TmdbTitle> {
  return {
    page: raw.page,
    results: raw.results.map((r) => normalizeTitle(r, fallbackType)).filter((t): t is TmdbTitle => t !== null),
    total_pages: raw.total_pages,
    total_results: raw.total_results,
  };
}

const toProviders = (list?: RawWatchProvider[]): TmdbProvider[] =>
  (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path }));

export function normalizeDetails(raw: RawDetails, mediaType: MediaType): TmdbTitleDetails | null {
  const base = normalizeTitle(raw, mediaType);
  if (!base) return null;
  const providers: TmdbTitleDetails['providers'] = {};
  for (const [region, r] of Object.entries(raw['watch/providers']?.results ?? {})) {
    providers[region] = { link: r.link, flatrate: toProviders(r.flatrate), rent: toProviders(r.rent), buy: toProviders(r.buy) };
  }
  const list = (p?: RawPage<RawListItem>) =>
    (p?.results ?? []).map((r) => normalizeTitle(r, mediaType)).filter((t): t is TmdbTitle => t !== null);
  return {
    ...base,
    tagline: raw.tagline,
    cast: raw.credits?.cast.map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path,
    })),
    directors: raw.credits?.crew.filter((c) => c.job === 'Director').map((c) => c.name),
    videos: raw.videos?.results.map((v) => ({ key: v.key, name: v.name, site: v.site, type: v.type })),
    similar: list(raw.similar),
    recommendations: list(raw.recommendations),
    providers,
  };
}

/**
 * Live TMDB adapter. Talks to OUR proxy, never to TMDB directly, so the TMDB
 * API key stays server-side. The proxy forwards `${base}/<tmdb path>?<query>`
 * to `https://api.themoviedb.org/3/<tmdb path>?<query>&api_key=...`.
 */
export function createLiveTmdb(
  proxyUrl: string = DEFAULT_TMDB_PROXY,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): TmdbService {
  const base = (proxyUrl || DEFAULT_TMDB_PROXY).replace(/\/$/, '');

  async function get<T>(path: string, query: Query = {}): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') qs.set(k, String(v));
    const s = qs.toString();
    const res = await fetchImpl(`${base}${path}${s ? `?${s}` : ''}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new TmdbHttpError(res.status, path);
    return (await res.json()) as T;
  }

  const list = (path: string, query: Query, type?: MediaType) =>
    get<RawPage<RawListItem>>(path, query).then((p) => normalizePage(p, type));

  let genreCache: Promise<TmdbGenre[]> | null = null;

  return {
    trending(page = 1, mediaType = 'all', window = 'day') {
      return list(`/trending/${mediaType}/${window}`, { page }, mediaType === 'all' ? undefined : mediaType);
    },
    popular(mediaType, page = 1) {
      return list(`/${mediaType}/popular`, { page }, mediaType);
    },
    topRated(mediaType, page = 1) {
      return list(`/${mediaType}/top_rated`, { page }, mediaType);
    },
    upcoming(page = 1) {
      return list('/movie/upcoming', { page }, 'movie');
    },
    nowPlaying(page = 1) {
      return list('/movie/now_playing', { page }, 'movie');
    },
    byGenre(mediaType, genreId, page = 1) {
      return list(`/discover/${mediaType}`, { with_genres: genreId, sort_by: 'popularity.desc', page }, mediaType);
    },
    discover({ mediaType = 'movie', genreId, page = 1, sortBy = 'popularity' } = {}) {
      const dateKey = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
      const sort_by =
        sortBy === 'rating' ? 'vote_average.desc' : sortBy === 'date' ? `${dateKey}.desc` : 'popularity.desc';
      return list(`/discover/${mediaType}`, { with_genres: genreId, sort_by, page }, mediaType);
    },
    async search(query, page = 1, filters = {}) {
      const q = query.trim();
      if (!q) return { page: 1, results: [], total_pages: 1, total_results: 0 };
      const { mediaType, year, includeAdult = false } = filters;
      const yearKey = mediaType === 'tv' ? 'first_air_date_year' : mediaType === 'movie' ? 'primary_release_year' : 'year';
      return list(
        `/search/${mediaType ?? 'multi'}`,
        { query: q, page, include_adult: includeAdult, [yearKey]: year },
        mediaType,
      );
    },
    async details(mediaType, id) {
      try {
        const raw = await get<RawDetails>(`/${mediaType}/${id}`, { append_to_response: DETAILS_APPEND });
        return normalizeDetails(raw, mediaType);
      } catch (e) {
        if (e instanceof TmdbHttpError && e.status === 404) return null;
        throw e;
      }
    },
    genres() {
      genreCache ??= Promise.all([
        get<{ genres: RawGenre[] }>('/genre/movie/list'),
        get<{ genres: RawGenre[] }>('/genre/tv/list'),
      ])
        .then(([m, t]) => {
          const byId = new Map<number, TmdbGenre>();
          for (const g of [...m.genres, ...t.genres]) byId.set(g.id, { id: g.id, name: g.name });
          return [...byId.values()];
        })
        .catch((e: unknown) => {
          genreCache = null;
          throw e;
        });
      return genreCache;
    },
    imageUrl(path: string, size: TmdbImageSize = 'w500') {
      return tmdbImageUrl(path, size);
    },
  };
}
