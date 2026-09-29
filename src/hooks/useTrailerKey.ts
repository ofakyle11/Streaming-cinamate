import { useEffect, useState } from 'react';
import { tmdb as defaultTmdb, type MediaType, type TmdbService } from '../services';
import { pickTrailerKey } from '../lib/trailer';

/** Session cache: "type:id" -> trailer key (null = looked up, none found). */
const cache = new Map<string, string | null>();
const cacheKey = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

/** Test helper. */
export function clearTrailerCache(): void {
  cache.clear();
}

/**
 * Resolve the YouTube trailer key for a title; null while loading, when none
 * exists, or on error. `enabled: false` skips the lookup entirely.
 */
export function useTrailerKey(
  title: { id: number; mediaType: MediaType } | null | undefined,
  { enabled = true, svc = defaultTmdb }: { enabled?: boolean; svc?: TmdbService } = {},
): string | null {
  const id = title?.id;
  const mediaType = title?.mediaType;
  const [resolved, setResolved] = useState<{ k: string; key: string | null } | null>(null);

  useEffect(() => {
    if (!enabled || id == null || !mediaType) return;
    const k = cacheKey(mediaType, id);
    if (cache.has(k)) return;
    let cancelled = false;
    svc
      .videos(mediaType, id)
      .then(pickTrailerKey, () => null)
      .then((key) => {
        cache.set(k, key);
        if (!cancelled) setResolved({ k, key });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, id, mediaType, svc]);

  if (!enabled || id == null || !mediaType) return null;
  const k = cacheKey(mediaType, id);
  if (cache.has(k)) return cache.get(k) ?? null;
  return resolved?.k === k ? resolved.key : null;
}
