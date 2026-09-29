import { NotConfiguredError, type TmdbImageSize, type TmdbService, type TmdbVideo } from '../types';

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
    discover: async () => notReady(),
    search: async () => notReady(),
    details: async () => notReady(),
    genres: async () => notReady(),
    async videos(mediaType, id) {
      // Proxy mirrors TMDB: GET {proxy}/{movie|tv}/{id}/videos -> { results: TmdbVideo[] }
      const res = await fetch(`${base}/${mediaType}/${encodeURIComponent(String(id))}/videos`);
      if (!res.ok) throw new Error(`TMDB videos request failed (${res.status})`);
      const body = (await res.json()) as { results?: TmdbVideo[] };
      return Array.isArray(body.results) ? body.results : [];
    },
    imageUrl(path: string, size: TmdbImageSize = 'w500') {
      return `https://image.tmdb.org/t/p/${size}${path}`;
    },
  };
}
