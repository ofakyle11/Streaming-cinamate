/**
 * Title-page extras (cast, similar, watch providers, trailer). Mock adapter only
 * for now: deterministic data derived from the title id, no env vars needed.
 * Provider data is attributed to JustWatch in the UI, as TMDB requires.
 */
import type { MediaType, Movie, TmdbService } from './types';
import { tmdb, toMovie } from './index';

export type Region = 'US' | 'CA';

export interface CastMember {
  id: number;
  name: string;
  character: string;
  photo: string;
}

export interface WatchProvider {
  id: number;
  name: string;
  kind: 'stream' | 'rent' | 'buy';
}

export interface TitleExtras {
  cast: CastMember[];
  similar: Movie[];
  providers: Record<Region, WatchProvider[]>;
  /** null when no trailer is available. */
  trailerUrl: string | null;
}

const FIRST = ['Ava', 'Noah', 'Mila', 'Theo', 'Iris', 'Jonah', 'Lena', 'Omar', 'Sasha', 'Felix', 'Nora', 'Kai'];
const LAST = ['Hart', 'Vance', 'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Reyes', 'Quinn', 'Adler', 'Byrne'];
const ROLES = ['The Pilot', 'Dr. Wren', 'The Stranger', 'Captain Ives', 'Maya', 'Detective Cole', 'The Archivist', 'Eli', 'Rosa', 'Warden'];
const PROVIDERS: Omit<WatchProvider, 'kind'>[] = [
  { id: 1, name: 'StreamBox' },
  { id: 2, name: 'Lumen+' },
  { id: 3, name: 'NorthScreen' },
  { id: 4, name: 'Reelhouse' },
  { id: 5, name: 'PixelRent' },
];

function mockCast(id: number): CastMember[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: id * 10 + i,
    name: `${FIRST[(id + i * 5) % FIRST.length]} ${LAST[(id * 3 + i) % LAST.length]}`,
    character: ROLES[(id + i) % ROLES.length],
    photo: `https://picsum.photos/seed/lfcast${id}-${i}/185/278`,
  }));
}

function mockProviders(id: number, region: Region): WatchProvider[] {
  const kinds: WatchProvider['kind'][] = ['stream', 'rent', 'buy'];
  const offset = region === 'CA' ? 2 : 0;
  const count = (id + offset) % 4; // 0..3 so some titles have none
  return Array.from({ length: count }, (_, i) => ({
    ...PROVIDERS[(id + offset + i) % PROVIDERS.length],
    kind: kinds[i % kinds.length],
  }));
}

export async function loadTitle(
  mediaType: MediaType,
  id: number,
  svc: TmdbService = tmdb,
): Promise<{ movie: Movie; extras: TitleExtras } | null> {
  const [t, genres] = await Promise.all([svc.details(mediaType, id), svc.genres()]);
  if (!t) return null;
  const movie = toMovie(t, genres, svc);
  const pool = await svc.discover({ mediaType, genreId: t.genre_ids[0] });
  const similar = pool.results
    .filter((x) => x.id !== t.id)
    .slice(0, 10)
    .map((x) => toMovie(x, genres, svc));
  return {
    movie,
    extras: {
      cast: mockCast(id),
      similar,
      providers: { US: mockProviders(id, 'US'), CA: mockProviders(id, 'CA') },
      trailerUrl: id % 5 === 0 ? null : movie.backdrop,
    },
  };
}
