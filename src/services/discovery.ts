/**
 * Discovery data helpers (New & Popular). Pure functions over a TmdbService so
 * they work on the mock adapter (no env vars) and the live one alike.
 */
import { tmdb, toMovie } from './index';
import type { CatalogRow, TmdbPage, TmdbService, TmdbTitle } from './types';

/** Max titles per row. */
export const NEW_POPULAR_ROW_SIZE = 20;

/**
 * Loads the New & Popular rows: trending this week, coming soon, now playing
 * and popular TV. Empty rows are dropped so the page never shows a blank shelf.
 */
export async function loadNewPopular(svc: TmdbService = tmdb): Promise<CatalogRow[]> {
  const [genres, trending, upcoming, nowPlaying, popularTv] = await Promise.all([
    svc.genres(),
    svc.trending(1, { window: 'week' }),
    svc.upcoming(),
    svc.nowPlaying(),
    svc.popular('tv'),
  ]);
  const map = (page: TmdbPage<TmdbTitle>) =>
    page.results.slice(0, NEW_POPULAR_ROW_SIZE).map((t) => toMovie(t, genres, svc));

  const rows: CatalogRow[] = [
    { title: 'Trending This Week', items: map(trending) },
    { title: 'Coming Soon', items: map(upcoming) },
    { title: 'Now Playing', items: map(nowPlaying) },
    { title: 'Popular TV', items: map(popularTv) },
  ];
  return rows.filter((r) => r.items.length > 0);
}
