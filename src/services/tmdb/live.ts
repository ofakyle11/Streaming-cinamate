import {
  NotConfiguredError,
  type MediaType,
  type TmdbCastMember,
  type TmdbImageSize,
  type TmdbPage,
  type TmdbService,
  type TmdbTitle,
  type TmdbVideo,
  type TmdbWatchProvider,
  type TmdbWatchProviders,
  type WatchRegion,
} from '../types';

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
    imageUrl(path: string, size: TmdbImageSize = 'w500') {
      return `https://image.tmdb.org/t/p/${size}${path}`;
    },
    async credits(mediaType, id) {
      const res = await proxyGet<{ cast?: TmdbCastMember[] }>(base, `/${mediaType}/${id}/credits`);
      return (res.cast ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character ?? '',
        profile_path: c.profile_path ?? null,
        order: c.order ?? 0,
      }));
    },
    async similar(mediaType, id, page = 1) {
      const res = await proxyGet<TmdbPage<RawTitle>>(base, `/${mediaType}/${id}/similar?page=${page}`);
      return {
        ...res,
        results: (res.results ?? []).filter((t) => t.id !== id).map((t) => normaliseTitle(t, mediaType)),
      };
    },
    async videos(mediaType, id) {
      const res = await proxyGet<{ results?: TmdbVideo[] }>(base, `/${mediaType}/${id}/videos`);
      return res.results ?? [];
    },
    async watchProviders(mediaType, id, region) {
      const res = await proxyGet<{ results?: Record<string, RawProviders | undefined> }>(
        base,
        `/${mediaType}/${id}/watch/providers`,
      );
      const r = res.results?.[region];
      return r ? normaliseProviders(r, region) : null;
    },
  };
}

/* ---------------------------------------------------- title extras (w1) */

type RawTitle = Omit<TmdbTitle, 'media_type' | 'release_date' | 'runtime'> & {
  media_type?: MediaType;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
};

interface RawProviders {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
}

async function proxyGet<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB proxy ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

function normaliseTitle(t: RawTitle, mediaType: MediaType): TmdbTitle {
  return {
    ...t,
    media_type: t.media_type ?? mediaType,
    poster_path: t.poster_path ?? '',
    backdrop_path: t.backdrop_path ?? '',
    genre_ids: t.genre_ids ?? [],
    release_date: t.release_date ?? t.first_air_date ?? '',
    runtime: t.runtime ?? t.episode_run_time?.[0] ?? 0,
  };
}

function normaliseProviders(r: RawProviders, region: WatchRegion): TmdbWatchProviders {
  const byPriority = (list?: TmdbWatchProvider[]) =>
    list ? [...list].sort((a, b) => a.display_priority - b.display_priority) : undefined;
  return {
    region,
    link: r.link ?? '',
    flatrate: byPriority(r.flatrate),
    free: byPriority(r.free),
    ads: byPriority(r.ads),
    rent: byPriority(r.rent),
    buy: byPriority(r.buy),
  };
}
