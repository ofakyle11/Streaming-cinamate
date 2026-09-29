import { useEffect, useState } from 'react';
import {
  tmdb as defaultTmdb,
  toMovie,
  type MediaType,
  type Movie,
  type TmdbCastMember,
  type TmdbService,
  type TmdbTitle,
  type TmdbVideo,
  type TmdbWatchProviders,
  type WatchRegion,
} from '../services';

export interface TitleDetails {
  movie: Movie;
  /** Raw record, for fields the Movie view model does not carry (e.g. vote_average). */
  raw: TmdbTitle;
  cast: TmdbCastMember[];
  similar: Movie[];
  trailer: TmdbVideo | null;
}

export type TitleDetailsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TitleDetails };

const MAX_CAST = 15;
const MAX_SIMILAR = 12;

/** Validates the `/title/:type/:id` params. Returns null when they cannot name a title. */
export function parseTitleParams(
  type: string | undefined,
  id: string | undefined,
): { mediaType: MediaType; id: number } | null {
  if (type !== 'movie' && type !== 'tv') return null;
  if (!id || !/^\d+$/.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? { mediaType: type, id: n } : null;
}

/** Best video to play: official trailers first, then any trailer, then teasers. */
export function pickTrailer(videos: readonly TmdbVideo[]): TmdbVideo | null {
  const rank = (v: TmdbVideo) =>
    (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 2 : 4) + (v.official ? 0 : 1);
  const candidates = videos.filter((v) => v.type === 'Trailer' || v.type === 'Teaser');
  return [...candidates].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** "2h 5m" / "45m"; empty string when unknown. */
export function formatRuntime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Loads everything the title page needs. Secondary sections degrade to empty on failure. */
export async function loadTitleDetails(
  mediaType: MediaType,
  id: number,
  svc: TmdbService = defaultTmdb,
): Promise<TitleDetails | null> {
  const [raw, genres] = await Promise.all([svc.details(mediaType, id), svc.genres()]);
  if (!raw) return null;

  const [cast, similar, videos] = await Promise.all([
    svc.credits(mediaType, id).catch(() => [] as TmdbCastMember[]),
    svc.similar(mediaType, id).then((p) => p.results).catch(() => [] as TmdbTitle[]),
    svc.videos(mediaType, id).catch(() => [] as TmdbVideo[]),
  ]);

  return {
    movie: toMovie(raw, genres, svc),
    raw,
    cast: [...cast].sort((a, b) => a.order - b.order).slice(0, MAX_CAST),
    similar: similar
      .filter((t) => t.id !== id)
      .slice(0, MAX_SIMILAR)
      .map((t) => toMovie(t, genres, svc)),
    trailer: pickTrailer(videos),
  };
}

/** Title page data for `/title/:type/:id` params (raw strings from the router). */
export function useTitleDetails(type: string | undefined, id: string | undefined, svc: TmdbService = defaultTmdb) {
  const [attempt, setAttempt] = useState(0);
  // Results are tagged with the request they answer; a stale tag reads as "loading".
  const [result, setResult] = useState<{ key: string; state: TitleDetailsState } | null>(null);
  const parsed = parseTitleParams(type, id);
  const key = parsed ? `${parsed.mediaType}/${parsed.id}#${attempt}` : '';

  useEffect(() => {
    if (!parsed) return;
    let cancelled = false;
    const settle = (state: TitleDetailsState) => {
      if (!cancelled) setResult({ key, state });
    };
    loadTitleDetails(parsed.mediaType, parsed.id, svc)
      .then((data) => settle(data ? { status: 'ready', data } : { status: 'not-found' }))
      .catch((e: unknown) =>
        settle({ status: 'error', message: e instanceof Error ? e.message : 'Could not load this title.' }),
      );
    return () => {
      cancelled = true;
    };
    // `parsed` is derived from `key`; depending on the key avoids refetching on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, svc]);

  const state: TitleDetailsState = !parsed
    ? { status: 'not-found' }
    : result && result.key === key
      ? result.state
      : { status: 'loading' };

  return { state, retry: () => setAttempt((n) => n + 1) };
}

export type WatchProvidersState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: TmdbWatchProviders | null };

/** Where-to-watch offers for one region; refetches when the region changes. */
export function useWatchProviders(
  mediaType: MediaType,
  id: number,
  region: WatchRegion,
  svc: TmdbService = defaultTmdb,
): WatchProvidersState {
  const key = `${mediaType}/${id}/${region}`;
  const [result, setResult] = useState<{ key: string; state: WatchProvidersState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    svc
      .watchProviders(mediaType, id, region)
      .then((data) => {
        if (!cancelled) setResult({ key, state: { status: 'ready', data } });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, state: { status: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [key, mediaType, id, region, svc]);

  return result && result.key === key ? result.state : { status: 'loading' };
}

/** Default region from the browser locale: en-CA / fr-CA -> CA, otherwise US. */
export function defaultWatchRegion(locale?: string): WatchRegion {
  const l = locale ?? (typeof navigator !== 'undefined' ? navigator.language : '');
  return /[-_]CA$/i.test(l ?? '') ? 'CA' : 'US';
}
