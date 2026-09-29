/**
 * Raw TMDB v3 response shapes as returned through our proxy, plus the
 * image-size vocabulary. The live adapter normalises these into `TmdbTitle`.
 */
import type { MediaType } from '../types';

export type TrendingMediaType = 'all' | MediaType;
export type TrendingWindow = 'day' | 'week';

export const POSTER_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'] as const;
export const BACKDROP_SIZES = ['w300', 'w780', 'w1280', 'original'] as const;
export const PROFILE_SIZES = ['w45', 'w185', 'h632', 'original'] as const;
export const LOGO_SIZES = ['w45', 'w92', 'w154', 'w185', 'w300', 'w500', 'original'] as const;
export type TmdbAnyImageSize =
  | (typeof POSTER_SIZES)[number]
  | (typeof BACKDROP_SIZES)[number]
  | (typeof PROFILE_SIZES)[number]
  | (typeof LOGO_SIZES)[number];

export interface RawPage<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

/** A list item: movie, tv, or (in multi-search / trending all) person. */
export interface RawListItem {
  id: number;
  media_type?: MediaType | 'person';
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  genres?: RawGenre[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  adult?: boolean;
}

export interface RawGenre {
  id: number;
  name: string;
}

export interface RawCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  order?: number;
}

export interface RawCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface RawCredits {
  cast: RawCastMember[];
  crew: RawCrewMember[];
}

export interface RawVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
}

export interface RawWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

export interface RawWatchProviderRegion {
  link?: string;
  flatrate?: RawWatchProvider[];
  rent?: RawWatchProvider[];
  buy?: RawWatchProvider[];
}

export interface RawDetails extends RawListItem {
  tagline?: string;
  credits?: RawCredits;
  videos?: { results: RawVideo[] };
  similar?: RawPage<RawListItem>;
  recommendations?: RawPage<RawListItem>;
  'watch/providers'?: { results: Record<string, RawWatchProviderRegion> };
}
