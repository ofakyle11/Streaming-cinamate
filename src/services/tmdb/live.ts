import { NotConfiguredError, type MediaType, type DiscoverSort, type TmdbImageSize, type TmdbService } from '../types';
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
 * so the TMDB API key stays server-side. Stub for now: every call throws until
 * the proxy contract is finalised.
 */
export function createLiveTmdb(proxyUrl: string): TmdbService {
  const base = proxyUrl.replace(/\/$/, '');
  const notReady = (): never => {
    throw new NotConfiguredError('TMDB', 'VITE_TMDB_PROXY (proxy endpoints not implemented)');
  };
  void base;
  return {
    trending: async () => notReady(),
    popular: async () => notReady(),
    topRated: async () => notReady(),
    nowPlaying: async () => notReady(),
    discover: async (opts) => {
      // Request shape is final (incl. optional sortBy); transport lands with the proxy contract.
      void buildDiscoverPath(opts ?? {});
      return notReady();
    },
    search: async () => notReady(),
    details: async () => notReady(),
    genres: async () => notReady(),
    imageUrl(path: string, size: TmdbImageSize = 'w500') {
      return `https://image.tmdb.org/t/p/${size}${path}`;
    },
  };
}
