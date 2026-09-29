/**
 * Service contracts for Last Frame.
 * Every external dependency is expressed as an interface here; `index.ts` picks a
 * live or mock implementation. Mocks MUST work with no env vars at all.
 */

export type MediaType = 'movie' | 'tv';

/** TMDB-shaped title record (subset of /movie and /tv responses). */
export interface TmdbTitle {
  id: number;
  media_type: MediaType;
  /** Movies use `title`, TV uses `name`. Both may be present in mocks. */
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  genre_ids: number[];
  vote_average: number;
  /** ISO date (YYYY-MM-DD). TV uses `first_air_date` upstream; we normalise to release_date. */
  release_date: string;
  /** Minutes. */
  runtime: number;
  /** Content rating (e.g. PG-13, TV-MA). Not in base TMDB payloads; mocks supply it. */
  certification?: string;
  /** TMDB popularity score (higher = more popular). Optional; mocks supply it. */
  popularity?: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbPage<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

/** Sort orders supported by `TmdbService.discover`. Always descending. */
export type DiscoverSort = 'popularity' | 'rating' | 'date';

export type TmdbImageSize = 'w342' | 'w500' | 'w780' | 'w1280' | 'original' | 'w92' | 'w154' | 'w185' | 'w300' | 'h632';

export interface TmdbService {
  trending(page?: number, opts?: TmdbTrendingOptions): Promise<TmdbPage<TmdbTitle>>;
  popular(mediaType: MediaType, page?: number): Promise<TmdbPage<TmdbTitle>>;
  topRated(mediaType: MediaType, page?: number): Promise<TmdbPage<TmdbTitle>>;
  nowPlaying(page?: number): Promise<TmdbPage<TmdbTitle>>;
  discover(opts: { mediaType?: MediaType; genreId?: number; page?: number; sortBy?: DiscoverSort }): Promise<TmdbPage<TmdbTitle>>;
  search(query: string, page?: number, filters?: TmdbSearchFilters): Promise<TmdbPage<TmdbTitle>>;
  /** Full record incl. credits, videos, similar, recommendations and watch providers when available. */
  details(mediaType: MediaType, id: number): Promise<TmdbTitleDetails | null>;
  /** All genres (movie + TV merged) or just one media type's list. */
  genres(mediaType?: MediaType): Promise<TmdbGenre[]>;
  /** Resolve a TMDB `*_path` to a fully qualified image URL. */
  imageUrl(path: string, size?: TmdbImageSize): string;
  /** Upcoming movie releases. */
  upcoming(page?: number): Promise<TmdbPage<TmdbTitle>>;
  /** Popular titles in a genre (movie by default). */
  byGenre(genreId: number, opts?: { mediaType?: MediaType; page?: number }): Promise<TmdbPage<TmdbTitle>>;
}

/* ------------------------------------------------------ TMDB extended types */

export interface TmdbTrendingOptions {
  /** 'all' (default) mixes movies and TV. */
  mediaType?: MediaType | 'all';
  /** 'day' (default) or 'week'. */
  window?: 'day' | 'week';
}

export interface TmdbSearchFilters {
  /** Restrict to movies or TV; omitted = multi search (movies + TV, people dropped). */
  mediaType?: MediaType;
  /** Release / first-air year. */
  year?: number;
  /** Keep only results tagged with this genre (applied to the returned page). */
  genreId?: number;
  /** Minimum vote average (0..10), applied to the returned page. */
  minRating?: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  /** e.g. 'YouTube', 'Vimeo'. */
  site: string;
  /** e.g. 'Trailer', 'Teaser', 'Clip'. */
  type: string;
  official: boolean;
}

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
}

/** Details view of a title. All extras are optional so a plain TmdbTitle still fits. */
export interface TmdbTitleDetails extends TmdbTitle {
  genres?: TmdbGenre[];
  tagline?: string;
  status?: string;
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  credits?: TmdbCredits;
  videos?: TmdbVideo[];
  similar?: TmdbTitle[];
  recommendations?: TmdbTitle[];
  /** Keyed by ISO 3166-1 region code (e.g. 'US', 'CA'). */
  watchProviders?: Record<string, TmdbWatchProviderRegion>;
}

/* TMDB wire types (what the proxy returns, straight from api.themoviedb.org/3). */

export interface TmdbRawListItem {
  id: number;
  media_type?: MediaType | 'person';
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

export interface TmdbRawPage {
  page?: number;
  results?: TmdbRawListItem[];
  total_pages?: number;
  total_results?: number;
}

export interface TmdbRawDetails extends TmdbRawListItem {
  genres?: TmdbGenre[];
  runtime?: number | null;
  episode_run_time?: number[];
  tagline?: string;
  status?: string;
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  credits?: {
    cast?: Array<Partial<TmdbCastMember> & { id: number; profile_path?: string | null }>;
    crew?: Array<Partial<TmdbCrewMember> & { id: number; profile_path?: string | null }>;
  };
  videos?: { results?: Array<Partial<TmdbVideo>> };
  similar?: TmdbRawPage;
  recommendations?: TmdbRawPage;
  'watch/providers'?: { results?: Record<string, TmdbWatchProviderRegion> };
}

/* ---------------------------------------------------------------- UI model */

/** The view model the UI consumes. Derived from a TmdbTitle + genre lookup. */
export interface Movie {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number;
  rating: string;
  match: number;
  genres: string[];
  description: string;
  poster: string;
  backdrop: string;
  runtime: number;
}

export interface CatalogRow {
  title: string;
  items: Movie[];
}

/* -------------------------------------------------------------------- Auth */

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export type AuthUnsubscribe = () => void;

export interface AuthService {
  currentUser(): Promise<User | null>;
  signInWithEmail(email: string, password: string): Promise<User>;
  signUpWithEmail(email: string, password: string, displayName?: string): Promise<User>;
  signInWithMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(cb: (user: User | null) => void): AuthUnsubscribe;
}

/* ---------------------------------------------------------------------- DB */

export type ListKind = 'watchlist' | 'favorites' | 'history';

export interface ListEntry {
  id: string;
  userId: string;
  kind: ListKind;
  titleId: number;
  mediaType: MediaType;
  addedAt: string;
}

export interface WatchProgress {
  userId: string;
  titleId: number;
  mediaType: MediaType;
  /** 0..1 */
  progress: number;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  preferredGenres: number[];
  maturityRating: string;
}

export interface DbService {
  getProfile(userId: string): Promise<UserProfile | null>;
  upsertProfile(profile: UserProfile): Promise<UserProfile>;
  listEntries(userId: string, kind: ListKind): Promise<ListEntry[]>;
  addToList(userId: string, kind: ListKind, titleId: number, mediaType: MediaType): Promise<ListEntry>;
  removeFromList(userId: string, kind: ListKind, titleId: number): Promise<void>;
  getProgress(userId: string, titleId: number): Promise<WatchProgress | null>;
  setProgress(progress: WatchProgress): Promise<WatchProgress>;
}

/* ----------------------------------------------------------------- Billing */

export type PlanId = 'free' | 'plus' | 'premium';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in minor units (cents). */
  priceCents: number;
  currency: string;
  features: string[];
}

export interface Subscription {
  userId: string;
  planId: PlanId;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  renewsAt: string | null;
}

/**
 * Billing contract. No payment-provider SDK is ever imported on the client.
 * A live adapter would call our own backend, which owns any provider secrets.
 */
export interface BillingService {
  plans(): Promise<Plan[]>;
  subscription(userId: string): Promise<Subscription>;
  startCheckout(userId: string, planId: PlanId): Promise<{ url: string }>;
  cancel(userId: string): Promise<Subscription>;
}

/* --------------------------------------------------------------- Analytics */

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsService {
  identify(userId: string | null, traits?: AnalyticsProps): void;
  track(event: string, props?: AnalyticsProps): void;
  page(name: string, props?: AnalyticsProps): void;
}

/* -------------------------------------------------------------- Aggregate */

export type AdapterMode = 'live' | 'mock';

export interface Services {
  tmdb: TmdbService;
  auth: AuthService;
  db: DbService;
  billing: BillingService;
  analytics: AnalyticsService;
  /** Which adapter each service resolved to; useful for a debug badge. */
  mode: Record<'tmdb' | 'auth' | 'db' | 'billing' | 'analytics', AdapterMode>;
}

export class NotConfiguredError extends Error {
  constructor(service: string, envVar: string) {
    super(`${service} live adapter is not configured (missing ${envVar}).`);
    this.name = 'NotConfiguredError';
  }
}
