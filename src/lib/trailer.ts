import type { TmdbVideo } from '../services/types';

/** YouTube video ids are 11 chars of [A-Za-z0-9_-]. Anything else is rejected. */
const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

export function isYouTubeKey(key: unknown): key is string {
  return typeof key === 'string' && YOUTUBE_KEY.test(key);
}

const TYPE_RANK: Record<string, number> = { Trailer: 0, Teaser: 1 };

/**
 * Pick the best YouTube trailer key from a TMDB videos list:
 * YouTube only, Trailer before Teaser, official before unofficial.
 * Returns null when nothing suitable exists.
 */
export function pickTrailerKey(videos: readonly TmdbVideo[] | null | undefined): string | null {
  if (!videos?.length) return null;
  const candidates = videos
    .filter((v) => v.site === 'YouTube' && v.type in TYPE_RANK && isYouTubeKey(v.key))
    .sort(
      (a, b) =>
        TYPE_RANK[a.type] - TYPE_RANK[b.type] ||
        Number(Boolean(b.official)) - Number(Boolean(a.official)),
    );
  return candidates[0]?.key ?? null;
}

/**
 * Muted, chromeless, looping embed URL on the privacy-enhanced domain.
 * `enablejsapi` lets us mute/unmute via postMessage without reloading the iframe.
 */
export function youTubeEmbedUrl(key: string, origin?: string): string {
  if (!isYouTubeKey(key)) throw new Error('Invalid YouTube key');
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: key,
    playsinline: '1',
    modestbranding: '1',
    rel: '0',
    iv_load_policy: '3',
    disablekb: '1',
    enablejsapi: '1',
  });
  if (origin) params.set('origin', origin);
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${key}?${params.toString()}`;
}

/** YouTube IFrame API command, sent to the embed via postMessage. */
export function youTubeCommand(func: 'mute' | 'unMute' | 'playVideo' | 'pauseVideo'): string {
  return JSON.stringify({ event: 'command', func, args: [] });
}

/** Minimal TMDB video for the TrailerModal, built from a resolved YouTube key. */
export function trailerVideoFromKey(key: string, title: string): TmdbVideo {
  return { id: key, key, site: 'YouTube', type: 'Trailer', name: `${title} trailer` };
}
