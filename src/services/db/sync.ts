/**
 * Pure store <-> row mapping and last-write-wins merge for cloud sync.
 * No I/O here: the engine (syncEngine.ts) wires this to the store and the DB adapter.
 */
import type {
  HistoryEntry,
  LastFrameState,
  Profile,
  RatingEntry,
  WatchlistEntry,
} from '../../state/store';
import type {
  SyncChange,
  SyncHistoryRow,
  SyncProfileRow,
  SyncRatingRow,
  SyncSnapshot,
  SyncWatchlistRow,
} from '../types';

/** The persisted data part of the store that is mirrored to the cloud. */
export type SyncableState = Pick<LastFrameState, 'activeProfileId' | 'profiles' | 'watchlist' | 'history' | 'ratings'>;

/** Name the store gives a freshly created, untouched profile. */
export const DEFAULT_PROFILE_NAME = 'Me';

/** Avatar the store gives a freshly created profile. */
export const DEFAULT_PROFILE_AVATAR = '🎬';

export type SyncRowMap = Map<string, SyncChange>;

function newProfileId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Store data for a brand-new guest: one untouched default profile, no lists. */
export function freshGuestState(now: number = Date.now()): SyncableState {
  const profile: Profile = {
    id: newProfileId(),
    name: DEFAULT_PROFILE_NAME,
    avatar: DEFAULT_PROFILE_AVATAR,
    kid: false,
    createdAt: now,
  };
  return { profiles: [profile], activeProfileId: profile.id, watchlist: {}, history: {}, ratings: {} };
}

/** Stable identity of a row: table + primary key (user id is implicit). */
export function rowKey(change: SyncChange): string {
  if (change.table === 'profiles') return `profiles:${change.row.profileId}`;
  return `${change.table}:${change.row.profileId}:${change.row.titleId}`;
}

/* ------------------------------------------------------------- store -> rows */

/** Every live row in the store. `updatedAt` is the entry's own timestamp. */
export function rowsFromState(state: SyncableState): SyncRowMap {
  const out: SyncRowMap = new Map();
  const add = (c: SyncChange) => out.set(rowKey(c), c);

  for (const p of state.profiles) {
    add({
      table: 'profiles',
      row: {
        profileId: p.id,
        name: p.name,
        avatar: p.avatar,
        kid: p.kid,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
        deleted: false,
      },
    });
  }
  for (const [profileId, list] of Object.entries(state.watchlist ?? {})) {
    for (const e of list ?? []) {
      add({ table: 'watchlist', row: { profileId, titleId: e.titleId, addedAt: e.addedAt, updatedAt: e.addedAt, deleted: false } });
    }
  }
  for (const [profileId, list] of Object.entries(state.history ?? {})) {
    for (const e of list ?? []) {
      add({
        table: 'history',
        row: {
          profileId,
          titleId: e.titleId,
          position: e.position,
          duration: e.duration,
          lastWatchedAt: e.lastWatchedAt,
          completed: e.completed,
          updatedAt: e.lastWatchedAt,
          deleted: false,
        },
      });
    }
  }
  for (const [profileId, list] of Object.entries(state.ratings ?? {})) {
    for (const e of list ?? []) {
      add({
        table: 'ratings',
        row: { profileId, titleId: e.titleId, rating: e.rating, ratedAt: e.ratedAt, updatedAt: e.ratedAt, deleted: false },
      });
    }
  }
  return out;
}

/** Row content without the sync bookkeeping, for change detection. */
function content(c: SyncChange): string {
  const { updatedAt: _u, deleted: _d, ...rest } = c.row;
  void _u;
  void _d;
  return JSON.stringify(rest);
}

/**
 * Changes between two store states, stamped `now`: new/edited rows are
 * upserts, vanished rows become tombstones (`deleted: true`).
 */
export function diffStates(prev: SyncableState, next: SyncableState, now: number): SyncChange[] {
  if (
    prev.profiles === next.profiles &&
    prev.watchlist === next.watchlist &&
    prev.history === next.history &&
    prev.ratings === next.ratings
  ) {
    return [];
  }
  const before = rowsFromState(prev);
  const after = rowsFromState(next);
  const changes: SyncChange[] = [];

  for (const [key, c] of after) {
    const old = before.get(key);
    if (!old || content(old) !== content(c)) {
      changes.push({ ...c, row: { ...c.row, updatedAt: now, deleted: false } } as SyncChange);
    }
  }
  for (const [key, old] of before) {
    if (!after.has(key)) changes.push({ ...old, row: { ...old.row, updatedAt: now, deleted: true } } as SyncChange);
  }
  return changes;
}

/* ------------------------------------------------------------- rows <-> snapshot */

export function snapshotToRows(snapshot: SyncSnapshot): SyncRowMap {
  const out: SyncRowMap = new Map();
  const add = (c: SyncChange) => {
    const key = rowKey(c);
    const existing = out.get(key);
    if (!existing || existing.row.updatedAt < c.row.updatedAt) out.set(key, c);
  };
  snapshot.profiles.forEach((row) => add({ table: 'profiles', row }));
  snapshot.watchlist.forEach((row) => add({ table: 'watchlist', row }));
  snapshot.history.forEach((row) => add({ table: 'history', row }));
  snapshot.ratings.forEach((row) => add({ table: 'ratings', row }));
  return out;
}

/** Rebuild the store's data slices from live (non-deleted) rows. */
export function stateFromRows(
  rows: Iterable<SyncChange>,
  activeProfileId: string | null,
): SyncableState {
  const profiles: Profile[] = [];
  const watchlist: Record<string, WatchlistEntry[]> = {};
  const history: Record<string, HistoryEntry[]> = {};
  const ratings: Record<string, RatingEntry[]> = {};
  const push = <T>(rec: Record<string, T[]>, pid: string, v: T) => {
    (rec[pid] ??= []).push(v);
  };

  for (const c of rows) {
    if (c.row.deleted) continue;
    switch (c.table) {
      case 'profiles': {
        const r: SyncProfileRow = c.row;
        profiles.push({ id: r.profileId, name: r.name, avatar: r.avatar, kid: r.kid, createdAt: r.createdAt });
        break;
      }
      case 'watchlist': {
        const r: SyncWatchlistRow = c.row;
        push(watchlist, r.profileId, { titleId: r.titleId, addedAt: r.addedAt });
        break;
      }
      case 'history': {
        const r: SyncHistoryRow = c.row;
        push(history, r.profileId, {
          titleId: r.titleId,
          position: r.position,
          duration: r.duration,
          lastWatchedAt: r.lastWatchedAt,
          completed: r.completed,
        });
        break;
      }
      case 'ratings': {
        const r: SyncRatingRow = c.row;
        push(ratings, r.profileId, { titleId: r.titleId, rating: r.rating, ratedAt: r.ratedAt });
        break;
      }
    }
  }

  // Match the store's ordering: profiles oldest first, lists newest first.
  profiles.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const live = new Set(profiles.map((p) => p.id));
  const tidy = <T>(rec: Record<string, T[]>, ts: (v: T) => number) => {
    const out: Record<string, T[]> = {};
    for (const [pid, list] of Object.entries(rec)) {
      if (live.has(pid)) out[pid] = list.sort((a, b) => ts(b) - ts(a));
    }
    return out;
  };

  return {
    profiles,
    activeProfileId: activeProfileId && live.has(activeProfileId) ? activeProfileId : (profiles[0]?.id ?? null),
    watchlist: tidy(watchlist, (e) => e.addedAt),
    history: tidy(history, (e) => e.lastWatchedAt),
    ratings: tidy(ratings, (e) => e.ratedAt),
  };
}

/* ------------------------------------------------------------- merge */

export interface MergeResult {
  /** New store data after applying remote winners. */
  state: SyncableState;
  /** Local winners the server does not have yet. */
  push: SyncChange[];
}

/**
 * A profile the store auto-created on this device and nobody touched: default
 * name, no list/history/rating data, never synced. Dropped on first sign-in
 * when the account already has profiles, so each new device does not add a
 * stray "Me".
 */
function isPristineProfile(local: SyncRowMap, profileId: string): boolean {
  const p = local.get(`profiles:${profileId}`);
  if (!p || p.table !== 'profiles' || p.row.deleted || p.row.name !== DEFAULT_PROFILE_NAME) return false;
  for (const c of local.values()) {
    if (c.table !== 'profiles' && c.row.profileId === profileId && !c.row.deleted) return false;
  }
  return true;
}

/**
 * Last-write-wins merge of the local store with the server snapshot.
 *
 * - `pending` holds local edits not yet acknowledged by the server (including
 *   tombstones); they carry the time they were made and override the store's
 *   intrinsic timestamps.
 * - Per row the newer `updatedAt` wins; ties go to the server (already stored).
 * - Rows only on one side are kept (unless they are tombstones).
 */
export function mergeSnapshots(
  localState: SyncableState,
  remote: SyncSnapshot,
  pending: ReadonlyMap<string, SyncChange> = new Map(),
  now: number = Date.now(),
): MergeResult {
  const local = rowsFromState(localState);
  for (const [key, c] of pending) local.set(key, c);
  const server = snapshotToRows(remote);

  const serverHasProfiles = [...server.values()].some((c) => c.table === 'profiles' && !c.row.deleted);
  const winners: SyncRowMap = new Map();
  const push: SyncChange[] = [];

  for (const key of new Set([...local.keys(), ...server.keys()])) {
    const l = local.get(key);
    const r = server.get(key);
    if (l && !r) {
      if (
        l.table === 'profiles' &&
        serverHasProfiles &&
        !pending.has(key) &&
        isPristineProfile(local, l.row.profileId)
      ) {
        continue;
      }
      winners.set(key, l);
      push.push(l);
    } else if (r && !l) {
      winners.set(key, r);
    } else if (l && r) {
      if (l.row.updatedAt > r.row.updatedAt) {
        winners.set(key, l);
        push.push(l);
      } else {
        winners.set(key, r);
      }
    }
  }

  let state = stateFromRows(winners.values(), localState.activeProfileId);

  // The app always needs at least one profile. If the merge removed them all
  // (e.g. every profile was deleted elsewhere), revive the local first one.
  if (state.profiles.length === 0) {
    const fallback = localState.profiles[0];
    if (fallback) {
      const revived: SyncChange = {
        table: 'profiles',
        row: {
          profileId: fallback.id,
          name: fallback.name,
          avatar: fallback.avatar,
          kid: fallback.kid,
          createdAt: fallback.createdAt,
          updatedAt: now,
          deleted: false,
        },
      };
      winners.set(rowKey(revived), revived);
      push.push(revived);
      state = stateFromRows(winners.values(), localState.activeProfileId);
    }
  }

  return { state, push };
}

/**
 * Replace the local data with the account's server snapshot instead of merging.
 * Used when the store holds data that belongs to a different account (someone
 * else signed in on this device before), so none of it may be uploaded.
 *
 * `ownPending` must only contain this account's own unsent edits (its
 * persisted queue). A fresh default profile stands in for the local side, so a
 * brand-new account still ends up with one profile while an account that
 * already has profiles gets exactly its own.
 */
export function adoptSnapshot(
  remote: SyncSnapshot,
  ownPending: ReadonlyMap<string, SyncChange> = new Map(),
  now: number = Date.now(),
): MergeResult {
  return mergeSnapshots(freshGuestState(now), remote, ownPending, now);
}
