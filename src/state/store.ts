import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RatingEntry {
  titleId: TitleId;
  rating: Rating;
  ratedAt: number;
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
  removeFromWatchlist: (titleId: TitleId) => void;
  toggleWatchlist: (titleId: TitleId, mediaType?: MediaType) => void;
}

export interface HistorySlice {
  history: PerProfile<HistoryEntry[]>;
  recordProgress: (titleId: TitleId, position: number, duration: number) => void;
  markCompleted: (titleId: TitleId) => void;
  clearHistory: () => void;
}

export interface RatingsSlice {
  ratings: PerProfile<RatingEntry[]>;
  rateTitle: (titleId: TitleId, rating: Rating) => void;
  clearRating: (titleId: TitleId) => void;
}

export type LastFrameState = ProfilesSlice & WatchlistSlice & HistorySlice & RatingsSlice;

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

// Stable empty references so selectors don't trigger re-renders on missing keys.
const EMPTY_WATCHLIST: WatchlistEntry[] = [];
const EMPTY_HISTORY: HistoryEntry[] = [];
const EMPTY_RATINGS: RatingEntry[] = [];

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
          const profiles = s.profiles.filter((p) => p.id !== id);
          const activeProfileId =
            s.activeProfileId === id ? (profiles[0]?.id ?? null) : s.activeProfileId;
          return {
            profiles,
            activeProfileId,
            watchlist: omitKey(s.watchlist, id),
            history: omitKey(s.history, id),
            ratings: omitKey(s.ratings, id),
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
          if (list.some((e) => e.titleId === titleId)) return {};
          const entry: WatchlistEntry = mediaType ? { titleId, addedAt: Date.now(), mediaType } : { titleId, addedAt: Date.now() };
          return { watchlist: { ...s.watchlist, [pid]: [entry, ...list] } };
        }),

      removeFromWatchlist: (titleId) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.watchlist[pid] ?? [];
          return { watchlist: { ...s.watchlist, [pid]: list.filter((e) => e.titleId !== titleId) } };
        }),

      toggleWatchlist: (titleId, mediaType) => {
        const { activeProfileId, watchlist, addToWatchlist, removeFromWatchlist } = get();
        if (!activeProfileId) return;
        const has = (watchlist[activeProfileId] ?? []).some((e) => e.titleId === titleId);
        if (has) removeFromWatchlist(titleId);
        else addToWatchlist(titleId, mediaType);
      },

      // ---- history ----
      history: {},

      recordProgress: (titleId, position, duration) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const rest = (s.history[pid] ?? []).filter((e) => e.titleId !== titleId);
          const completed = duration > 0 && position / duration >= 0.9;
          const entry: HistoryEntry = { titleId, position, duration, lastWatchedAt: Date.now(), completed };
          return { history: { ...s.history, [pid]: [entry, ...rest] } };
        }),

      markCompleted: (titleId) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.history[pid] ?? [];
          const existing = list.find((e) => e.titleId === titleId);
          const entry: HistoryEntry = {
            titleId,
            position: existing?.duration ?? 0,
            duration: existing?.duration ?? 0,
            lastWatchedAt: Date.now(),
            completed: true,
          };
          return { history: { ...s.history, [pid]: [entry, ...list.filter((e) => e.titleId !== titleId)] } };
        }),

      clearHistory: () =>
        set((s) => (s.activeProfileId ? { history: { ...s.history, [s.activeProfileId]: [] } } : {})),

      // ---- ratings ----
      ratings: {},

      rateTitle: (titleId, rating) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const rest = (s.ratings[pid] ?? []).filter((e) => e.titleId !== titleId);
          return { ratings: { ...s.ratings, [pid]: [{ titleId, rating, ratedAt: Date.now() }, ...rest] } };
        }),

      clearRating: (titleId) =>
        set((s) => {
          const pid = s.activeProfileId;
          if (!pid) return {};
          const list = s.ratings[pid] ?? [];
          return { ratings: { ...s.ratings, [pid]: list.filter((e) => e.titleId !== titleId) } };
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
