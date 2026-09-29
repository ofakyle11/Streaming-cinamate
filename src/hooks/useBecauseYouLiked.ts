import { useEffect, useMemo, useState } from 'react';
import { tmdb, toMovie } from '../services';
import type { MediaType, Movie, TmdbService } from '../services/types';
import { selectRatings, selectThumbs, useLastFrameStore } from '../state/store';
import { becauseYouLikedTitle, dedupeRecommendationRows, likedSeeds, ratedTitleKeys } from '../lib/ratings';

export interface BecauseYouLikedRow {
  /** Stable row id, e.g. `byl-movie-1000`. */
  id: string;
  /** "Because you liked <title>". */
  title: string;
  items: Movie[];
}

/** How many liked titles seed a row. */
export const BYL_SEED_COUNT = 2;

type SeedTuple = [mediaType: MediaType, id: number, title: string | null];

const rowId = (mediaType: MediaType, id: number) => `byl-${mediaType}-${id}`;

/**
 * "Because you liked X" rows for the active profile, built from the top-rated
 * titles' similar lists (TMDB /similar via the mock or live adapter).
 * Already-rated titles are filtered at render time, so thumbing a card hides it
 * instantly. Seeds that fail to load are skipped: the row is a bonus, not core UI.
 */
export function useBecauseYouLiked(svc: TmdbService = tmdb, seedCount = BYL_SEED_COUNT): BecauseYouLikedRow[] {
  const ratings = useLastFrameStore(selectRatings);
  const thumbs = useLastFrameStore(selectThumbs);

  // Serialised seed list: effects re-run only when the seeds change, not on every rating.
  const seedsKey = useMemo(
    () => JSON.stringify(likedSeeds(ratings, thumbs, seedCount).map((s): SeedTuple => [s.mediaType, s.id, s.title])),
    [ratings, thumbs, seedCount],
  );

  const [loaded, setLoaded] = useState<BecauseYouLikedRow[]>([]);

  useEffect(() => {
    const seeds = JSON.parse(seedsKey) as SeedTuple[];
    if (seeds.length === 0) return;
    let alive = true;
    const load = async () => {
      const genres = await svc.genres().catch(() => []);
      const rows = await Promise.all(
        seeds.map(async ([mediaType, id, title]): Promise<BecauseYouLikedRow | null> => {
          try {
            const [page, name] = await Promise.all([
              svc.similar(mediaType, id),
              title ? Promise.resolve(title) : svc.details(mediaType, id).then((d) => d?.title ?? d?.name ?? null),
            ]);
            if (!name) return null;
            return {
              id: rowId(mediaType, id),
              title: becauseYouLikedTitle(name),
              items: page.results.map((t) => toMovie(t, genres, svc)),
            };
          } catch {
            return null;
          }
        }),
      );
      if (alive) setLoaded(rows.filter((r): r is BecauseYouLikedRow => r !== null));
    };
    void load();
    return () => {
      alive = false;
    };
  }, [seedsKey, svc]);

  const exclude = useMemo(() => ratedTitleKeys(ratings, thumbs), [ratings, thumbs]);

  return useMemo(() => {
    // Keep showing previously loaded rows whose seed is still liked while new seeds load.
    const current = new Set((JSON.parse(seedsKey) as SeedTuple[]).map(([m, id]) => rowId(m, id)));
    const rows = loaded.filter((r) => current.has(r.id));
    return dedupeRecommendationRows(rows, exclude).filter((r) => r.items.length > 0);
  }, [seedsKey, loaded, exclude]);
}
