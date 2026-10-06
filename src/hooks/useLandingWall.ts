import { useEffect, useState } from 'react';
import { tmdb, toMovie } from '../services';
import type { Movie, TmdbService } from '../services/types';
import { uniqueTitles } from '../pages/homeRows';

/** Tiles in the landing page's poster wall (3 x 3 on desktop, the first 6 on phones). */
export const WALL_COUNT = 9;

export type LandingWallState =
  | { status: 'loading'; items: [] }
  | { status: 'ready'; items: Movie[] }
  | { status: 'error'; items: [] };

/**
 * This week's trending titles for the landing page poster wall, from the
 * catalogue service (the mock with no env vars, live TMDB later). One request,
 * no retry: the wall is decoration, so a failure just leaves the tinted tiles.
 */
export function useLandingWall(svc: TmdbService = tmdb, count = WALL_COUNT): LandingWallState {
  const [state, setState] = useState<LandingWallState>({ status: 'loading', items: [] });

  // `svc` and `count` are fixed for a page's lifetime, so no reset to loading is needed on change.
  useEffect(() => {
    let alive = true;
    Promise.all([svc.genres(), svc.trending(1, { window: 'week' })])
      .then(([genres, page]) => {
        if (!alive) return;
        const items = uniqueTitles(
          page.results.map((t) => toMovie(t, genres, svc)),
          count,
        );
        setState({ status: 'ready', items });
      })
      .catch(() => {
        if (alive) setState({ status: 'error', items: [] });
      });
    return () => {
      alive = false;
    };
  }, [svc, count]);

  return state;
}
