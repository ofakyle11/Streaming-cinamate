/**
 * Service locator. Picks live adapters when their env vars are present, else
 * mocks. With no env vars at all the whole app runs on mocks.
 *
 *   VITE_TMDB_PROXY        -> live TMDB (via our proxy)
 *   VITE_SUPABASE_URL      -> live Auth + DB (needs VITE_SUPABASE_ANON_KEY too)
 *
 * Billing and analytics are mock-only on the client by design.
 */
import type { CatalogRow, Movie, Services, TmdbGenre, TmdbService, TmdbTitle } from './types';
import { createMockTmdb } from './tmdb/mock';
import { createLiveTmdb } from './tmdb/live';
import { createMockAuth } from './auth/mock';
import { createLiveAuth } from './auth/live';
import { createMockDb } from './db/mock';
import { createLiveDb } from './db/live';
import { createMockBilling } from './billing/mock';
import { createMockAnalytics } from './analytics/mock';

export * from './types';

const env = import.meta.env;
const tmdbProxy = (env.VITE_TMDB_PROXY as string | undefined)?.trim();
const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnon = (env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

const useLiveTmdb = Boolean(tmdbProxy);
const useLiveSupabase = Boolean(supabaseUrl);

export const services: Services = {
  tmdb: useLiveTmdb ? createLiveTmdb(tmdbProxy as string) : createMockTmdb(),
  auth: useLiveSupabase ? createLiveAuth(supabaseUrl as string, supabaseAnon) : createMockAuth(),
  db: useLiveSupabase ? createLiveDb(supabaseUrl as string, supabaseAnon) : createMockDb(),
  billing: createMockBilling(),
  analytics: createMockAnalytics(),
  mode: {
    tmdb: useLiveTmdb ? 'live' : 'mock',
    auth: useLiveSupabase ? 'live' : 'mock',
    db: useLiveSupabase ? 'live' : 'mock',
    billing: 'mock',
    analytics: 'mock',
  },
};

export const { tmdb, auth, db, billing, analytics } = services;

/* ------------------------------------------------------- TMDB -> UI mapping */

/** Deterministic "match %" until we have real personalisation. */
function matchScore(t: TmdbTitle): number {
  const base = Math.round(t.vote_average * 10); // 61..93
  return Math.min(99, Math.max(60, base + (t.id % 7)));
}

export function toMovie(t: TmdbTitle, genres: readonly TmdbGenre[], svc: TmdbService = tmdb): Movie {
  const genreMap = new Map(genres.map((g) => [g.id, g.name]));
  return {
    id: t.id,
    mediaType: t.media_type,
    title: t.title ?? t.name ?? 'Untitled',
    year: Number(t.release_date?.slice(0, 4)) || new Date().getFullYear(),
    rating: t.certification ?? (t.media_type === 'tv' ? 'TV-14' : 'PG-13'),
    match: matchScore(t),
    genres: t.genre_ids.map((id) => genreMap.get(id)).filter((g): g is string => Boolean(g)),
    description: t.overview,
    poster: svc.imageUrl(t.poster_path, 'w500'),
    backdrop: svc.imageUrl(t.backdrop_path, 'w1280'),
    runtime: t.runtime,
    ...(t.trailer_key ? { trailerKey: t.trailer_key } : {}),
  };
}

/** Home-page catalogue: hero features + rows, built from the active TMDB adapter. */
export async function loadHomeCatalog(svc: TmdbService = tmdb): Promise<{ featured: Movie[]; rows: CatalogRow[] }> {
  const genres = await svc.genres();
  const map = (page: { results: TmdbTitle[] }) => page.results.map((t) => toMovie(t, genres, svc));

  const genreRows = [
    { id: 28, title: 'Action' },
    { id: 35, title: 'Comedy' },
    { id: 878, title: 'Sci-Fi' },
  ];

  const [trending, popMovies, popTv, topRated, upcoming, ...genrePages] = await Promise.all([
    svc.trending(),
    svc.popular('movie'),
    svc.popular('tv'),
    svc.topRated('movie'),
    svc.upcoming(),
    ...genreRows.map((g) => svc.discover({ genreId: g.id })),
  ]);

  const trendingMovies = map(trending);
  const rows: CatalogRow[] = [
    { title: 'Trending', items: trendingMovies.slice(0, 10) },
    { title: 'Popular Movies', items: map(popMovies).slice(0, 10) },
    { title: 'Popular TV', items: map(popTv).slice(0, 10) },
    { title: 'Top Rated', items: map(topRated).slice(0, 10) },
    { title: 'New & Upcoming', items: map(upcoming).slice(0, 10) },
    ...genreRows.map((g, i) => ({ title: g.title, items: map(genrePages[i]).slice(0, 10) })),
  ];
  return {
    featured: trendingMovies.slice(0, 5),
    rows: rows.filter((r) => r.items.length > 0),
  };
}
