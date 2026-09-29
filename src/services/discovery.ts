/**
 * Discovery data helpers (New & Popular). Pure functions over a TmdbService so
 * they work on the mock adapter (no env vars) and the live one alike.
 */
import { tmdb, toMovie } from './index';
import type { CatalogRow, Movie, TmdbPage, TmdbService, TmdbTitle } from './types';

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

/** Home catalogue shape (hero features + rows). */
export interface HomeCatalog {
  featured: Movie[];
  rows: CatalogRow[];
}

/** Max titles per Home row / hero features. */
const HOME_ROW_SIZE = 10;
const HOME_FEATURED_SIZE = 5;

/**
 * Resilient Home catalogue. Unlike `loadHomeCatalog`, one failing endpoint
 * (429/502/504 from the proxy) does not blank the page: rejected or empty rows
 * are dropped, and hero features come from the first non-empty source
 * (trending, then popular TV, then now playing). Throws only when every
 * source failed or came back empty.
 */
export async function loadHomeCatalogSafe(svc: TmdbService = tmdb): Promise<HomeCatalog> {
  // Wrap each call so a synchronous throw is settled like a rejection.
  const attempt = <T>(fn: () => Promise<T>): Promise<T> => Promise.resolve().then(fn);
  const [genresRes, ...settled] = await Promise.allSettled([
    attempt(() => svc.genres()),
    attempt(() => svc.trending()),
    attempt(() => svc.popular('tv')),
    attempt(() => svc.nowPlaying()),
    attempt(() => svc.discover({ genreId: 878 })),
  ]);
  // Genres only decorate cards; a failure there must not drop any row.
  const genres = genresRes.status === 'fulfilled' && Array.isArray(genresRes.value) ? genresRes.value : [];
  const titles = ['Trending Now', 'Top Picks for You', 'New Releases', 'Sci-Fi & Beyond'];

  let firstError: unknown;
  const sources: CatalogRow[] = settled.map((res, i) => {
    if (res.status === 'rejected') {
      firstError ??= res.reason;
      return { title: titles[i], items: [] };
    }
    const results: TmdbTitle[] = Array.isArray(res.value?.results) ? res.value.results : [];
    return { title: titles[i], items: results.map((t) => toMovie(t, genres, svc)) };
  });

  const rows = sources
    .map((s) => ({ title: s.title, items: s.items.slice(0, HOME_ROW_SIZE) }))
    .filter((r) => r.items.length > 0);

  if (rows.length === 0) {
    if (firstError instanceof Error) throw firstError;
    throw new Error(firstError === undefined ? 'The catalogue is empty right now.' : 'Could not load the catalogue.');
  }

  // Featured: trending -> popular TV -> now playing (Sci-Fi discover is not a hero source).
  const featuredSource = sources.slice(0, 3).find((s) => s.items.length > 0);
  const featured = featuredSource ? featuredSource.items.slice(0, HOME_FEATURED_SIZE) : [];
  return { featured, rows };
}
