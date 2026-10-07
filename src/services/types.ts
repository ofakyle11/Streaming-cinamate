/**
 * Service contracts for Lastframe.tv.
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

export type TmdbImageSize =
  'w342' | 'w500' | 'w780' | 'w1280' | 'original' | 'w92' | 'w154' | 'w185' | 'w300' | 'h632';

export interface TmdbService {
  trending(page?: number, opts?: TmdbTrendingOptions): Promise<TmdbPage<TmdbTitle>>;
  popular(mediaType: MediaType, page?: number): Promise<TmdbPage<TmdbTitle>>;
  topRated(mediaType: MediaType, page?: number): Promise<TmdbPage<TmdbTitle>>;
  nowPlaying(page?: number): Promise<TmdbPage<TmdbTitle>>;
  discover(opts: {
    mediaType?: MediaType;
    genreId?: number;
    page?: number;
    sortBy?: DiscoverSort;
    /** Earliest release / first-air year (inclusive). */
    yearFrom?: number;
    /** Latest release / first-air year (inclusive). */
    yearTo?: number;
    /** Minimum vote average (0..10). */
    minRating?: number;
  }): Promise<TmdbPage<TmdbTitle>>;
  search(query: string, page?: number, filters?: TmdbSearchFilters): Promise<TmdbPage<TmdbTitle>>;
  /** Full record incl. credits, videos, similar, recommendations and watch providers when available. */
  details(mediaType: MediaType, id: number): Promise<TmdbTitleDetails | null>;
  /** All genres (movie + TV merged) or just one media type's list. */
  genres(mediaType?: MediaType): Promise<TmdbGenre[]>;
  /** Videos (trailers, teasers, ...) attached to a title. Empty when none. */
  videos(mediaType: MediaType, id: number): Promise<TmdbVideo[]>;
  /** Resolve a TMDB `*_path` to a fully qualified image URL. */
  imageUrl(path: string, size?: TmdbImageSize): string;
  /** Upcoming movie releases. */
  upcoming(page?: number): Promise<TmdbPage<TmdbTitle>>;
  /** Popular titles in a genre (movie by default). */
  byGenre(
    genreId: number,
    opts?: { mediaType?: MediaType; page?: number },
  ): Promise<TmdbPage<TmdbTitle>>;
  /** Top-billed cast for a title (TMDB /credits `cast`, ordered by billing). */
  credits(mediaType: MediaType, id: number): Promise<TmdbCastMember[]>;
  /** Titles similar to the given one (TMDB /similar). Never includes the title itself. */
  similar(mediaType: MediaType, id: number, page?: number): Promise<TmdbPage<TmdbTitle>>;
  /** Where-to-watch offers for one region (TMDB /watch/providers, data by JustWatch). */
  watchProviders(
    mediaType: MediaType,
    id: number,
    region: WatchRegion,
  ): Promise<TmdbWatchProviders | null>;
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

/* ------------------------------------------------- TMDB title extras (w1) */

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  /** May be null (or empty) when TMDB has no headshot. */
  profile_path: string | null;
  /** Billing order, 0 = top billed. */
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

/** TMDB `/{type}/{id}/videos` result entry (subset). */
export interface TmdbVideo {
  id: string;
  /** Provider video id, e.g. the YouTube video key. */
  key: string;
  name: string;
  /** e.g. 'YouTube', 'Vimeo'. */
  site: 'YouTube' | 'Vimeo' | string;
  /** e.g. 'Trailer', 'Teaser', 'Clip'. */
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | string;
  official?: boolean;
}

/** Regions the Where-to-watch panel supports. */
export type WatchRegion = 'US' | 'CA';

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

/** One region's offers. Upstream data is supplied by JustWatch and must be attributed. */
export interface TmdbWatchProviders {
  region: WatchRegion;
  /** TMDB watch page for this title/region; empty when unknown. */
  link: string;
  flatrate?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
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
  popularity?: number;
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

/** OAuth providers the UI offers. */
export type OAuthProvider = 'google';

/** `global` signs out everywhere (every refresh token is revoked); `local` is this browser. */
export interface SignOutOptions {
  scope?: 'local' | 'global';
}

/**
 * A browser the account is signed in on (public.devices, kept by the app since
 * Supabase does not expose sessions to the client). `current` is this browser.
 */
export interface Device {
  id: string;
  /** e.g. "Chrome on macOS"; derived from the user agent on the client. */
  label: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  /**
   * When "forget this device" was used. `listDevices()` hides revoked rows (the
   * forgotten browser deletes its row as it signs itself out), so this is null
   * for everything the account page lists today.
   */
  revokedAt: string | null;
  current: boolean;
}

export interface MagicLinkOptions {
  captchaToken?: string;
}

/** Auth values captured from the /auth/callback URL (see src/auth/callback.ts). */
export interface AuthCallbackParams {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  token_hash?: string;
  type?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
}

export interface AuthService {
  currentUser(): Promise<User | null>;
  /**
   * Emails a magic link. `captchaToken` is the Cloudflare Turnstile token when
   * the bot check is enabled (VITE_TURNSTILE_SITE_KEY); Supabase verifies it.
   */
  signInWithMagicLink(email: string, options?: MagicLinkOptions): Promise<void>;
  /**
   * Finishes a magic link / OAuth return from the parameters the callback
   * route captured (and already stripped from the URL). Resolves with the
   * signed-in user; rejects with a readable error for expired or reused links.
   */
  completeSignIn(params: AuthCallbackParams): Promise<User>;
  /** Default scope is this browser; `global` is "sign out everywhere". */
  signOut(options?: SignOutOptions): Promise<void>;
  onAuthStateChange(cb: (user: User | null) => void): AuthUnsubscribe;
  /** Browsers this account is signed in on, newest activity first. Empty when signed out. */
  listDevices(): Promise<Device[]>;
  /**
   * Forget one device: a browser still running the app signs itself out the
   * next time it checks in (tab focus, or within a few minutes). It does not
   * revoke that browser's tokens, so a lost or stolen device needs
   * `signOut({ scope: 'global' })`. Forgetting the current device is a local sign-out.
   */
  forgetDevice(deviceId: string): Promise<void>;
  /**
   * Start an email change. Live: Supabase mails a confirmation to both the old
   * and the new address and the change applies once both are confirmed. Mock:
   * changes immediately.
   */
  changeEmail(newEmail: string): Promise<void>;
  /**
   * Start an OAuth sign-in. Live: redirects the browser to the provider and the
   * session is picked up on return. Mock: signs a demo user in immediately.
   */
  signInWithOAuth(provider: OAuthProvider): Promise<void>;
  /**
   * Erase the signed-in user's server-side data (or queue its erasure) and sign
   * out. Local device data is cleared separately by the caller.
   */
  requestDataDeletion(): Promise<void>;
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
  addToList(
    userId: string,
    kind: ListKind,
    titleId: number,
    mediaType: MediaType,
  ): Promise<ListEntry>;
  removeFromList(userId: string, kind: ListKind, titleId: number): Promise<void>;
  getProgress(userId: string, titleId: number): Promise<WatchProgress | null>;
  setProgress(progress: WatchProgress): Promise<WatchProgress>;
  /**
   * Cloud sync: fetch every synced row (tombstones included) for the signed-in
   * user. Returns `null` when there is no remote store (mock mode), which turns
   * sync off entirely.
   */
  pullSnapshot(userId: string): Promise<SyncSnapshot | null>;
  /** Cloud sync: upsert rows (deletes are `deleted: true` tombstones). No-op in mock mode. */
  pushChanges(userId: string, changes: SyncChange[]): Promise<void>;
}

/* -------------------------------------------------------------- DB sync */

/**
 * Rows mirrored between the local zustand store and Supabase
 * (supabase/schema.sql). Times are epoch ms. `updatedAt` drives
 * last-write-wins; deletions are soft (`deleted: true`) so they propagate.
 */
interface SyncRowBase {
  profileId: string;
  updatedAt: number;
  deleted: boolean;
}

export interface SyncProfileRow extends SyncRowBase {
  name: string;
  avatar: string;
  kid: boolean;
  createdAt: number;
}

export interface SyncWatchlistRow extends SyncRowBase {
  titleId: number;
  addedAt: number;
}

export interface SyncHistoryRow extends SyncRowBase {
  titleId: number;
  position: number;
  duration: number;
  lastWatchedAt: number;
  completed: boolean;
}

export interface SyncRatingRow extends SyncRowBase {
  titleId: number;
  rating: 1 | 2 | 3 | 4 | 5;
  ratedAt: number;
}

export interface SyncSnapshot {
  profiles: SyncProfileRow[];
  watchlist: SyncWatchlistRow[];
  history: SyncHistoryRow[];
  ratings: SyncRatingRow[];
}

export type SyncTable = keyof SyncSnapshot;

export type SyncChange =
  | { table: 'profiles'; row: SyncProfileRow }
  | { table: 'watchlist'; row: SyncWatchlistRow }
  | { table: 'history'; row: SyncHistoryRow }
  | { table: 'ratings'; row: SyncRatingRow };

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
