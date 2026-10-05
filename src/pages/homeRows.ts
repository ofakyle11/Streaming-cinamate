import type { MediaType, Movie, TmdbPage, TmdbService, TmdbTitle } from '../services/types';

/** One Home row: a label plus how to fetch its titles from the TMDB service. */
export interface HomeRowSpec {
  id: string;
  title: string;
  load(svc: TmdbService): Promise<TmdbPage<TmdbTitle>>;
}

/** Max cards per row. */
export const HOME_ROW_LIMIT = 12;

/** Genre rows use real TMDB genre ids so live and mock data line up. */
export const HOME_GENRES: ReadonlyArray<{ genreId: number; title: string }> = [
  { genreId: 28, title: 'Action Hits' },
  { genreId: 35, title: 'Comedy Picks' },
  { genreId: 878, title: 'Sci-Fi & Beyond' },
];

export const HOME_ROWS: readonly HomeRowSpec[] = [
  { id: 'trending', title: 'Trending Now', load: (svc) => svc.trending() },
  { id: 'popular-movies', title: 'Popular Movies', load: (svc) => svc.popular('movie') },
  { id: 'popular-tv', title: 'Popular TV', load: (svc) => svc.popular('tv') },
  { id: 'top-rated', title: 'Top Rated', load: (svc) => svc.topRated('movie') },
  { id: 'new-upcoming', title: 'New & Upcoming', load: (svc) => svc.nowPlaying() },
  ...HOME_GENRES.map(
    ({ genreId, title }): HomeRowSpec => ({
      id: `genre-${genreId}`,
      title,
      load: (svc) => svc.discover({ genreId }),
    }),
  ),
];

/** The row whose first items feed the hero carousel. */
export const HERO_ROW_ID = 'trending';
export const HERO_COUNT = 5;

/** Canonical title route: /title/:type/:id */
export function titlePath(m: { mediaType: MediaType; id: number }): string {
  return `/title/${m.mediaType}/${m.id}`;
}

/** Drop repeats (same media type + id) while keeping order, then cap the row. */
export function uniqueTitles(items: readonly Movie[], limit = HOME_ROW_LIMIT): Movie[] {
  const seen = new Set<string>();
  const out: Movie[] = [];
  for (const m of items) {
    const key = `${m.mediaType}:${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}
