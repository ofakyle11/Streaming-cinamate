import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isViewEntry, removeView, restoreView, upsertView, type ViewEntry, type ViewSource, type ViewedTitle } from '../lib/viewHistory';
import type { MediaType } from '../services/types';

/** Persisted slices for Last Frame. Keyed per profile so switching profiles swaps state. */

export type ProfileId = string;
export type TitleId = number;

export interface Profile {
  id: ProfileId;
  name: string;
  /** Emoji or short glyph used as the avatar; keeps the UI free of external assets. */
  avatar: string;
  kid: boolean;
  createdAt: number;
}

export interface WatchlistEntry {
  titleId: TitleId;
  addedAt: number;
  /** Movie or series; lets My List resolve the title. Absent on entries saved before w2-mylist. */
  mediaType?: MediaType;
}

export interface HistoryEntry {
  titleId: TitleId;
  /** Playback position in seconds. */
  position: number;
  /** Total duration in seconds (0 when unknown). */
  duration: number;
  lastWatchedAt: number;
  completed: boolean;
  /** Movie or series, so movie and TV ids cannot collide. Absent on entries saved before fu2. */
  mediaType?: MediaType;
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RatingEntry {
  titleId: TitleId;
  rating: Rating;
  ratedAt: number;
  /** Optional title metadata (w2-ratings) so recommendations can fetch similar titles. */
  mediaType?: 'movie' | 'tv';
  title?: string;
}

/** Thumbs up/down (w2-ratings). Independent of the optional 1–5 star rating. */
export type Thumb = 'up' | 'down';

/** Metadata stored alongside a rating/thumb so "Because you liked X" can be built offline. */
export interface RatedTitleMeta {
  mediaType: 'movie' | 'tv';
  title: string;
}

export interface ThumbEntry {
  titleId: TitleId;
  thumb: Thumb;
  ratedAt: number;
  mediaType?: 'movie' | 'tv';
  title?: string;
}

type PerProfile<T> = Record<ProfileId, T>;

export interface ProfilesSlice {
  activeProfileId: ProfileId | null;
  profiles: Profile[];
  addProfile: (input: Pick<Profile, 'name'> & Partial<Pick<Profile, 'avatar' | 'kid'>>) => Profile;
  updateProfile: (id: ProfileId, patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) => void;
  removeProfile: (id: ProfileId) => void;
  setActiveProfile: (id: ProfileId) => void;
}

export interface WatchlistSlice {
  watchlist: PerProfile<WatchlistEntry[]>;
  addToWatchlist: (titleId: TitleId, mediaType?: MediaType) => void;
  /** With `mediaType`, only that title (plus legacy untyped entries for the id) is removed. */
  removeFromWatchlist: (titleId: TitleId, mediaType?: MediaType) => void;
  toggleWatchlist: (titleId: TitleId, mediaType?: MediaType) => void;
}

export interface HistorySlice {
  history: PerProfile<HistoryEntry[]>;
  recordProgress: (titleId: TitleId, position: number, duration: number, mediaType?: MediaType) => void;
  markCompleted: (titleId: TitleId, mediaType?: MediaType) => void;
  clearHistory: () => void;
}

export interface RatingsSlice {
  ratings: PerProfile<RatingEntry[]>;
  /** With `mediaType`, a movie and a series sharing an id keep separate ratings. */
  rateTitle: (titleId: TitleId, rating: Rating, meta?: RatedTitleMeta, mediaType?: MediaType) => void;
  clearRating: (titleId: TitleId, mediaType?: MediaType) => void;
}

/** Viewed titles (title page opens / trailer plays) with timestamps; feeds Continue Watching + Recently Viewed. */
export interface ViewsSlice {
  views: PerProfile<ViewEntry[]>;
  recordView: (title: ViewedTitle, source: ViewSource) => void;
  removeView: (key: string) => void;
  clearViews: () => void;
  /** Undo a removal: re-inserts the exact entry snapshot (no new view recorded). */
  restoreView: (entry: ViewEntry) => void;
}

export interface ThumbsSlice {
  thumbs: PerProfile<ThumbEntry[]>;
  /** Sets the active profile's thumb for a title; `null` clears it. */
  setThumb: (titleId: TitleId, thumb: Thumb | null, meta?: RatedTitleMeta, mediaType?: MediaType) => void;
}

export type LastFrameState = ProfilesSlice & WatchlistSlice & HistorySlice & RatingsSlice & ViewsSlice & ThumbsSlice;

export const STORAGE_KEY = 'lastframe';
export const STORAGE_VERSION = 1;

const AVATARS = ['🎬', '🍿', '🎞️', '📽️', '🌙', '⭐'];

function newId(): ProfileId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultProfile(): Profile {
  return { id: newId(), name: 'Me', avatar: AVATARS[0], kid: false, createdAt: Date.now() };
}

/** Removes a key from a per-profile record without mutating the original. */
function omitKey<T>(record: PerProfile<T>, key: ProfileId): PerProfile<T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * Storage adapter that degrades gracefully: when localStorage is unavailable
 * (SSR, private mode, blocked site data) the store still works in memory.
 */
function safeStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = '__lf_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    /* fall through to memory */
  }
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    key: (i) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k) => {
      mem.delete(k);
    },
    setItem: (k, v) => {
      mem.set(k, v);
    },
  };
}

/**
 * Per-title identity (fu2): TMDB movie and TV ids overlap, so entries match on
 * id AND media type. Entries saved without a media type (legacy) match either
 * type, and callers that pass no media type keep the old id-only behaviour.
 */
export function matchesTitle(
  entry: { titleId: TitleId; mediaType?: MediaType },
  titleId: TitleId,
  mediaType?: MediaType,
): boolean {
  return entry.titleId === titleId && (mediaType === undefined || entry.mediaType === undefined || entry.mediaType === mediaType);
}

// Stable empty references so selectors don't trigger re-renders on missing keys.
const EMPTY_WATCHLIST: WatchlistEntry[] = [];
const EMPTY_HISTORY: HistoryEntry[] = [];
const EMPTY_RATINGS: RatingEntry[] = [];
const EMPTY_VIEWS: ViewEntry[] = [];
const EMPTY_THUMBS: ThumbEntry[] = [];

const defaultProfile = createDefaultProfile();

export const useLastFrameStore = create<LastFrameState>()(
  persist(
    (set, get) => ({
      // ---- profiles ----
      activeProfileId: defaultProfile.id,
      profiles: [defaultProfile],

      addProfile: (input) => {
        const { profiles } = get();
        const profile: Profile = {
          id: newId(),
          name: input.name.trim() || `Profile ${profiles.length + 1}`,
          avatar: input.avatar ?? AVATARS[profiles.length % AVATARS.length],
          kid: input.kid ?? false,
          createdAt: Date.now(),
        };
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: s.activeProfileId ?? profile.id,
        }));
        return profile;
      },

      updateProfile: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removeProfile: (id) =>
        set((s) => {
          // At least one profile must always exist.
          if (s.profiles.length <= 1 || !s.profiles.some((p) => p.id === id)) return {};
          const profiles = s.profiles.filter((p) => p.id !== id);
          const activeProfileId =
            s.activeProfileId === id ? (profiles[0]?.id ?? null) : s.activeProfileId;
          return {
            profiles,
            activeProfileId,
            watchlist: omitKey(s.watchlist, id),
            history: omitKey(s.history, id),
            ratings: omitKey(s.ratings, id),
            views: omitKey(s.views, id),
            thumbs: omitKey(s.thumbs, id),
          };
        }),

      setActiveProfile: (id) =>
        set((s) => (s.profiles.some((p) => p.id === id) ? { activeProfileId: id } : {})),

      // ---- watchlist ----
      watchlist: {},

      addToWatchlist: (titleId, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.watchlist[pid] ?? [];
          if (list.some((e) => matchesTitle(e, titleId, mediaType))) return {};
          const entry: WatchlistEntry = mediaType ? { titleId, addedAt: Date.now(), mediaType } : { titleId, addedAt: Date.now() };
          return { watchlist: { ...s.watchlist, [pid]: [entry, ...list] } };
        }),

      removeFromWatchlist: (titleId, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.watchlist[pid] ?? [];
          return { watchlist: { ...s.watchlist, [pid]: list.filter((e) => !matchesTitle(e, titleId, mediaType)) } };
        }),

      toggleWatchlist: (titleId, mediaType) => {
        const { activeProfileId, watchlist, addToWatchlist, removeFromWatchlist } = get();
        if (!activeProfileId) return;
        const has = (watchlist[activeProfileId] ?? []).some((e) => matchesTitle(e, titleId, mediaType));
        if (has) removeFromWatchlist(titleId, mediaType);
        else addToWatchlist(titleId, mediaType);
      },

      // ---- history ----
      history: {},

      recordProgress: (titleId, position, duration, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const rest = (s.history[pid] ?? []).filter((e) => !matchesTitle(e, titleId, mediaType));
          const completed = duration > 0 && position / duration >= 0.9;
          const entry: HistoryEntry = { titleId, position, duration, lastWatchedAt: Date.now(), completed };
          if (mediaType) entry.mediaType = mediaType;
          return { history: { ...s.history, [pid]: [entry, ...rest] } };
        }),

      markCompleted: (titleId, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.history[pid] ?? [];
          const existing = list.find((e) => matchesTitle(e, titleId, mediaType));
          const type = mediaType ?? existing?.mediaType;
          const entry: HistoryEntry = {
            titleId,
            position: existing?.duration ?? 0,
            duration: existing?.duration ?? 0,
            lastWatchedAt: Date.now(),
            completed: true,
          };
          if (type) entry.mediaType = type;
          return { history: { ...s.history, [pid]: [entry, ...list.filter((e) => !matchesTitle(e, titleId, mediaType))] } };
        }),

      clearHistory: () =>
        set((s) => (s.activeProfileId ? { history: { ...s.history, [s.activeProfileId]: [] } } : {})),

      // ---- ratings ----
      ratings: {},

      rateTitle: (titleId, rating, meta, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.ratings[pid] ?? [];
          const prev = list.find((e) => matchesTitle(e, titleId, mediaType));
          const rest = list.filter((e) => !matchesTitle(e, titleId, mediaType));
          const known = meta ?? (prev?.mediaType && prev.title ? { mediaType: prev.mediaType, title: prev.title } : null);
          const entry: RatingEntry = { titleId, rating, ratedAt: Date.now(), ...(known ?? {}) };
          if (mediaType && !entry.mediaType) entry.mediaType = mediaType;
          return { ratings: { ...s.ratings, [pid]: [entry, ...rest] } };
        }),

      clearRating: (titleId, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.ratings[pid] ?? [];
          return { ratings: { ...s.ratings, [pid]: list.filter((e) => !matchesTitle(e, titleId, mediaType)) } };
        }),

      // ---- viewed titles ----
      views: {},

      recordView: (title, source) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          return { views: { ...s.views, [pid]: upsertView(s.views[pid] ?? [], title, source) } };
        }),

      removeView: (key) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          return { views: { ...s.views, [pid]: removeView(s.views[pid] ?? [], key) } };
        }),

      clearViews: () =>
        set((s) => (s.activeProfileId ? { views: { ...s.views, [s.activeProfileId]: [] } } : {})),

      restoreView: (entry) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          return { views: { ...s.views, [pid]: restoreView(s.views[pid] ?? [], entry) } };
        }),

      // ---- thumbs (w2-ratings) ----
      thumbs: {},

      setThumb: (titleId, thumb, meta, mediaType) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const rest = (s.thumbs[pid] ?? []).filter((e) => !matchesTitle(e, titleId, mediaType));
          if (!thumb) return { thumbs: { ...s.thumbs, [pid]: rest } };
          const entry: ThumbEntry = { titleId, thumb, ratedAt: Date.now(), ...(meta ?? {}) };
          if (mediaType && !entry.mediaType) entry.mediaType = mediaType;
          return { thumbs: { ...s.thumbs, [pid]: [entry, ...rest] } };
        }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(safeStorage),
      // Persist only data, never action functions.
      partialize: (s) => ({
        activeProfileId: s.activeProfileId,
        profiles: s.profiles,
        watchlist: s.watchlist,
        history: s.history,
        ratings: s.ratings,
        views: s.views,
        thumbs: s.thumbs,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LastFrameState>;
        const profiles = Array.isArray(p.profiles) && p.profiles.length > 0 ? p.profiles : current.profiles;
        const activeProfileId =
          p.activeProfileId && profiles.some((x) => x.id === p.activeProfileId)
            ? p.activeProfileId
            : profiles[0]?.id ?? null;
        return {
          ...current,
          profiles,
          activeProfileId,
          watchlist: p.watchlist ?? {},
          history: p.history ?? {},
          ratings: p.ratings ?? {},
          views: sanitizeViews(p.views),
          thumbs: p.thumbs ?? {},
        };
      },
    },
  ),
);

// ---- Typed selectors (pure functions of state; usable outside React) ----

export const selectActiveProfile = (s: LastFrameState): Profile | null =>
  s.profiles.find((p) => p.id === s.activeProfileId) ?? null;

export const selectWatchlist = (s: LastFrameState): WatchlistEntry[] =>
  s.activeProfileId ? s.watchlist[s.activeProfileId] ?? EMPTY_WATCHLIST : EMPTY_WATCHLIST;

export const selectHistory = (s: LastFrameState): HistoryEntry[] =>
  s.activeProfileId ? s.history[s.activeProfileId] ?? EMPTY_HISTORY : EMPTY_HISTORY;

export const selectRatings = (s: LastFrameState): RatingEntry[] =>
  s.activeProfileId ? s.ratings[s.activeProfileId] ?? EMPTY_RATINGS : EMPTY_RATINGS;

export const selectIsInWatchlist = (titleId: TitleId) => (s: LastFrameState): boolean =>
  selectWatchlist(s).some((e) => e.titleId === titleId);

export const selectRatingFor = (titleId: TitleId) => (s: LastFrameState): Rating | null =>
  selectRatings(s).find((e) => e.titleId === titleId)?.rating ?? null;

export const selectHistoryFor = (titleId: TitleId) => (s: LastFrameState): HistoryEntry | null =>
  selectHistory(s).find((e) => e.titleId === titleId) ?? null;

/** In-progress titles, most recent first. Returns a new array; use with useShallow in components. */
export const selectContinueWatching = (s: LastFrameState): HistoryEntry[] =>
  selectHistory(s).filter((e) => !e.completed && e.position > 0);

export const selectViews = (s: LastFrameState): ViewEntry[] =>
  s.activeProfileId ? s.views[s.activeProfileId] ?? EMPTY_VIEWS : EMPTY_VIEWS;

/** Drops malformed persisted view entries (e.g. from hand-edited storage). */
function sanitizeViews(raw: unknown): PerProfile<ViewEntry[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: PerProfile<ViewEntry[]> = {};
  for (const [pid, list] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(list)) out[pid] = list.filter(isViewEntry);
  }
  return out;
}

// ---- thumbs selectors (w2-ratings) ----

export const selectThumbs = (s: LastFrameState): ThumbEntry[] =>
  s.activeProfileId ? s.thumbs[s.activeProfileId] ?? EMPTY_THUMBS : EMPTY_THUMBS;

export const selectThumbFor = (titleId: TitleId) => (s: LastFrameState): Thumb | null =>
  selectThumbs(s).find((e) => e.titleId === titleId)?.thumb ?? null;

// ---- media-type-aware selectors (fu2) ----
// Movie 1399 and TV 1399 are different titles; legacy entries without a media type match both.

export const selectIsInWatchlistFor = (titleId: TitleId, mediaType: MediaType) => (s: LastFrameState): boolean =>
  selectWatchlist(s).some((e) => matchesTitle(e, titleId, mediaType));

export const selectThumbForTitle = (titleId: TitleId, mediaType: MediaType) => (s: LastFrameState): Thumb | null =>
  selectThumbs(s).find((e) => matchesTitle(e, titleId, mediaType))?.thumb ?? null;

export const selectRatingForTitle = (titleId: TitleId, mediaType: MediaType) => (s: LastFrameState): Rating | null =>
  selectRatings(s).find((e) => matchesTitle(e, titleId, mediaType))?.rating ?? null;

export const selectHistoryForTitle = (titleId: TitleId, mediaType: MediaType) => (s: LastFrameState): HistoryEntry | null =>
  selectHistory(s).find((e) => matchesTitle(e, titleId, mediaType)) ?? null;
