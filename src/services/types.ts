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
  /** YouTube video key for the official trailer, when known. */
  trailer_key?: string;
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

export type TmdbImageSize = 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

export interface TmdbService {
  trending(page?: number): Promise<TmdbPage<TmdbTitle>>;
  popular(mediaType: MediaType, page?: number): Promise<TmdbPage<TmdbTitle>>;
  topRated(mediaType: MediaType, page?: number): Promise<TmdbPage<TmdbTitle>>;
  nowPlaying(page?: number): Promise<TmdbPage<TmdbTitle>>;
  discover(opts: { mediaType?: MediaType; genreId?: number; page?: number }): Promise<TmdbPage<TmdbTitle>>;
  search(query: string, page?: number): Promise<TmdbPage<TmdbTitle>>;
  details(mediaType: MediaType, id: number): Promise<TmdbTitle | null>;
  genres(): Promise<TmdbGenre[]>;
  /** Resolve a TMDB `*_path` to a fully qualified image URL. */
  imageUrl(path: string, size?: TmdbImageSize): string;
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
  /** YouTube trailer key, if any. */
  trailerKey?: string;
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
