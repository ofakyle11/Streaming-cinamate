import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SyncChange, SyncSnapshot } from '../types';
import { createMockDb } from './mock';
import { rowKey, type SyncableState } from './sync';
import {
  clearSyncOwner,
  pendingStorageKey,
  readSyncOwner,
  startCloudSync,
  SYNC_OWNER_KEY,
  type SyncStatus,
} from './syncEngine';

const initial = (): SyncableState => ({
  activeProfileId: 'p1',
  profiles: [{ id: 'p1', name: 'Ada', avatar: 'aurora', kid: false, createdAt: 100 }],
  watchlist: {},
  history: {},
  ratings: {},
});

const emptyRemote = (): SyncSnapshot => ({ profiles: [], watchlist: [], history: [], ratings: [] });

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function fakeDb(remote: SyncSnapshot | null = emptyRemote()) {
  return {
    pullSnapshot: vi.fn(async () => remote),
    pushChanges: vi.fn<(userId: string, changes: SyncChange[]) => Promise<void>>(async () => undefined),
  };
}

const addToWatchlist = (store: StoreApi<SyncableState>, titleId: number, at: number) =>
  store.setState((s) => ({ watchlist: { ...s.watchlist, p1: [{ titleId, addedAt: at }, ...(s.watchlist.p1 ?? [])] } }));

const pushedKeys = (db: ReturnType<typeof fakeDb>, call: number) =>
  (db.pushChanges.mock.calls[call]?.[1] ?? []).map(rowKey).sort();

let clock = 1_000;
beforeEach(() => {
  vi.useFakeTimers();
  clock = 1_000;
});
afterEach(() => {
  vi.useRealTimers();
});

const setup = (db = fakeDb(), storage = memoryStorage()) => {
  const store = createStore<SyncableState>()(() => initial());
  const statuses: SyncStatus[] = [];
  const sync = startCloudSync('user-1', {
    db,
    store,
    storage,
    debounceMs: 500,
    retryDelaysMs: [1_000, 3_000],
    now: () => clock,
    onStatus: (s) => statuses.push(s),
    flushOnHide: false,
  });
  return { store, sync, db, storage, statuses };
};

describe('cloud sync engine', () => {
  it('pulls, merges remote data into the store and uploads local-only rows', async () => {
    const remote = emptyRemote();
    remote.watchlist.push({ profileId: 'p1', titleId: 42, addedAt: 50, updatedAt: 50, deleted: false });
    const { store, sync, db } = setup(fakeDb(remote));

    await sync.ready;
    await vi.runAllTimersAsync();
    expect(db.pullSnapshot).toHaveBeenCalledWith('user-1');
    expect(store.getState().watchlist.p1).toEqual([{ titleId: 42, addedAt: 50 }]);
    // Applying the remote data must not echo back as a local change.
    expect(db.pushChanges).toHaveBeenCalledTimes(1);
    expect(pushedKeys(db, 0)).toEqual(['profiles:p1']);
    expect(sync.status).toBe('synced');
  });

  it('debounces local edits into one upsert', async () => {
    const { store, sync, db } = setup();
    await sync.ready;
    await vi.runAllTimersAsync();
    db.pushChanges.mockClear();

    clock = 2_000;
    addToWatchlist(store, 1, clock);
    await vi.advanceTimersByTimeAsync(300);
    addToWatchlist(store, 2, clock);
    await vi.advanceTimersByTimeAsync(300);
    expect(db.pushChanges).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(db.pushChanges).toHaveBeenCalledTimes(1);
    expect(pushedKeys(db, 0)).toEqual(['watchlist:p1:1', 'watchlist:p1:2']);
  });

  it('sends deletions as tombstones', async () => {
    const { store, sync, db } = setup();
    await sync.ready;
    addToWatchlist(store, 1, 1_500);
    await vi.runAllTimersAsync();
    db.pushChanges.mockClear();

    clock = 3_000;
    store.setState({ watchlist: { p1: [] } });
    await vi.runAllTimersAsync();
    expect(db.pushChanges.mock.calls[0][1]).toEqual([
      { table: 'watchlist', row: { profileId: 'p1', titleId: 1, addedAt: 1_500, updatedAt: 3_000, deleted: true } },
    ]);
  });

  it('queues edits made before the initial pull and sends them after the merge', async () => {
    let release: (s: SyncSnapshot) => void = () => {};
    const db = fakeDb();
    db.pullSnapshot.mockImplementation(() => new Promise<SyncSnapshot | null>((r) => (release = r)));
    const { store, sync } = setup(db);

    clock = 5_000;
    store.setState({ profiles: [{ id: 'p1', name: 'Renamed', avatar: 'aurora', kid: false, createdAt: 100 }] });
    expect(db.pushChanges).not.toHaveBeenCalled();

    const remote = emptyRemote();
    remote.profiles.push({ profileId: 'p1', name: 'Server', avatar: 'aurora', kid: false, createdAt: 100, updatedAt: 4_000, deleted: false });
    release(remote);
    await sync.ready;
    await vi.runAllTimersAsync();
    expect(store.getState().profiles[0].name).toBe('Renamed');
    expect(db.pushChanges.mock.calls[0][1]).toEqual([
      { table: 'profiles', row: expect.objectContaining({ name: 'Renamed', updatedAt: 5_000 }) },
    ]);
  });

  it('keeps and persists the queue when a push fails, then retries with backoff', async () => {
    const db = fakeDb();
    const storage = memoryStorage();
    const { store, sync } = setup(db, storage);
    await sync.ready;
    await vi.runAllTimersAsync();
    db.pushChanges.mockClear();

    db.pushChanges.mockRejectedValueOnce(new Error('offline'));
    addToWatchlist(store, 7, 2_000);
    await vi.advanceTimersByTimeAsync(500);
    expect(db.pushChanges).toHaveBeenCalledTimes(1);
    expect(sync.status).toBe('error');
    expect(JSON.parse(storage.map.get(pendingStorageKey('user-1')) ?? '[]')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(db.pushChanges).toHaveBeenCalledTimes(2);
    expect(sync.status).toBe('synced');
    expect(storage.map.has(pendingStorageKey('user-1'))).toBe(false);
  });

  it('restores a persisted queue from a previous session', async () => {
    const storage = memoryStorage();
    const tomb: SyncChange = { table: 'ratings', row: { profileId: 'p1', titleId: 3, rating: 4, ratedAt: 10, updatedAt: 900, deleted: true } };
    storage.setItem(pendingStorageKey('user-1'), JSON.stringify([tomb, { junk: true }]));
    const remote = emptyRemote();
    remote.profiles.push({ profileId: 'p1', name: 'Ada', avatar: 'aurora', kid: false, createdAt: 100, updatedAt: 100, deleted: false });
    remote.ratings.push({ profileId: 'p1', titleId: 3, rating: 4, ratedAt: 10, updatedAt: 10, deleted: false });
    const { store, sync, db } = setup(fakeDb(remote), storage);

    await sync.ready;
    await vi.runAllTimersAsync();
    expect(store.getState().ratings.p1).toBeUndefined();
    expect(db.pushChanges.mock.calls[0][1]).toEqual([tomb]);
  });

  it('retries the initial pull after a failure', async () => {
    const db = fakeDb();
    db.pullSnapshot.mockRejectedValueOnce(new Error('offline'));
    const { sync } = setup(db);
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.status).toBe('error');
    await vi.advanceTimersByTimeAsync(1_000);
    await sync.ready;
    expect(db.pullSnapshot).toHaveBeenCalledTimes(2);
  });

  it('turns itself off against the mock DB adapter', async () => {
    const mockDb = createMockDb();
    const db = { pullSnapshot: vi.fn(mockDb.pullSnapshot), pushChanges: vi.fn(mockDb.pushChanges) };
    const { store, sync } = setup(db as unknown as ReturnType<typeof fakeDb>);
    await sync.ready;
    expect(sync.status).toBe('disabled');
    addToWatchlist(store, 1, 2_000);
    await vi.runAllTimersAsync();
    expect(db.pushChanges).not.toHaveBeenCalled();
    await expect(mockDb.pushChanges('u', [])).resolves.toBeUndefined();
  });

  it('flushes on stop, and ignores store changes afterwards', async () => {
    const { store, sync, db } = setup();
    await sync.ready;
    await vi.runAllTimersAsync();
    db.pushChanges.mockClear();

    addToWatchlist(store, 1, 2_000);
    await sync.stop();
    expect(db.pushChanges).toHaveBeenCalledTimes(1);
    expect(sync.status).toBe('stopped');

    addToWatchlist(store, 2, 3_000);
    await vi.runAllTimersAsync();
    expect(db.pushChanges).toHaveBeenCalledTimes(1);
  });

  it('discards the queue on stop({ discard: true })', async () => {
    const db = fakeDb();
    db.pullSnapshot.mockImplementation(() => new Promise(() => {}));
    const { store, sync, storage } = setup(db);
    addToWatchlist(store, 1, 2_000);
    expect(storage.map.has(pendingStorageKey('user-1'))).toBe(true);
    await sync.stop({ discard: true });
    await sync.ready;
    expect(storage.map.has(pendingStorageKey('user-1'))).toBe(false);
    store.setState(initial());
    expect(storage.map.has(pendingStorageKey('user-1'))).toBe(false);
  });
});

describe('cloud sync engine: data ownership', () => {
  const remoteOf = (profileId: string, name: string, titleId: number): SyncSnapshot => ({
    profiles: [{ profileId, name, avatar: 'aurora', kid: false, createdAt: 10, updatedAt: 10, deleted: false }],
    watchlist: [{ profileId, titleId, addedAt: 20, updatedAt: 20, deleted: false }],
    history: [],
    ratings: [],
  });

  it('records the owner after merging guest data into the first account', async () => {
    const { sync, storage, db } = setup();
    expect(sync.linked).toBe(false);
    await sync.ready;
    await vi.runAllTimersAsync();
    expect(sync.linked).toBe(true);
    expect(storage.map.get(SYNC_OWNER_KEY)).toBe('user-1');
    expect(readSyncOwner(storage)).toBe('user-1');
    // Guest data (no owner recorded) is merged and uploaded as before.
    expect(pushedKeys(db, 0)).toEqual(['profiles:p1']);
  });

  it("replaces another account's local data with the server snapshot and uploads none of it", async () => {
    const storage = memoryStorage();
    storage.setItem(SYNC_OWNER_KEY, 'user-A');
    const db = fakeDb(remoteOf('pB', 'Bea', 77));
    const { store, sync } = setup(db, storage);
    // The store still holds user-A's data: profile p1 "Ada", plus history.
    store.setState({ history: { p1: [{ titleId: 5, position: 1, duration: 2, lastWatchedAt: 3, completed: false }] } });

    await sync.ready;
    await vi.runAllTimersAsync();
    expect(db.pushChanges).not.toHaveBeenCalled();
    const state = store.getState();
    expect(state.profiles.map((p) => p.id)).toEqual(['pB']);
    expect(state.activeProfileId).toBe('pB');
    expect(state.watchlist).toEqual({ pB: [{ titleId: 77, addedAt: 20 }] });
    expect(state.history).toEqual({});
    expect(storage.map.get(SYNC_OWNER_KEY)).toBe('user-1');
    expect(sync.status).toBe('synced');
  });

  it('gives a new account a fresh default profile instead of the previous account data', async () => {
    const storage = memoryStorage();
    storage.setItem(SYNC_OWNER_KEY, 'user-A');
    const { store, sync, db } = setup(fakeDb(emptyRemote()), storage);
    await sync.ready;
    await vi.runAllTimersAsync();
    const state = store.getState();
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0].id).not.toBe('p1');
    expect(state.profiles[0].name).toBe('Me');
    const pushed = db.pushChanges.mock.calls.flatMap((c) => c[1]);
    expect(pushed.map(rowKey)).toEqual([`profiles:${state.profiles[0].id}`]);
  });

  it("keeps the account's own persisted queue but drops edits made over another account's data", async () => {
    const storage = memoryStorage();
    storage.setItem(SYNC_OWNER_KEY, 'user-A');
    const own: SyncChange = {
      table: 'watchlist',
      row: { profileId: 'pB', titleId: 9, addedAt: 500, updatedAt: 500, deleted: false },
    };
    storage.setItem(pendingStorageKey('user-1'), JSON.stringify([own]));
    let release: (v: SyncSnapshot) => void = () => {};
    const db = fakeDb();
    db.pullSnapshot.mockImplementation(() => new Promise<SyncSnapshot>((r) => (release = r)));
    const { store, sync } = setup(db, storage);

    addToWatchlist(store, 123, 600); // made on user-A's profile p1 before the pull finished
    release(remoteOf('pB', 'Bea', 77));
    await sync.ready;
    await vi.runAllTimersAsync();

    const pushed = db.pushChanges.mock.calls.flatMap((c) => c[1]);
    expect(pushed).toEqual([own]);
    expect(store.getState().watchlist.pB?.map((e) => e.titleId)).toEqual([9, 77]);
    expect(store.getState().watchlist.p1).toBeUndefined();
  });

  it('merges normally when the recorded owner is the same account', async () => {
    const storage = memoryStorage();
    storage.setItem(SYNC_OWNER_KEY, 'user-1');
    const { store, sync, db } = setup(fakeDb(remoteOf('pB', 'Bea', 77)), storage);
    await sync.ready;
    await vi.runAllTimersAsync();
    expect(store.getState().profiles.map((p) => p.id).sort()).toEqual(['p1', 'pB']);
    expect(pushedKeys(db, 0)).toEqual(['profiles:p1']);
  });

  it('clearSyncOwner marks local data as guest data again', () => {
    const storage = memoryStorage();
    storage.setItem(SYNC_OWNER_KEY, 'user-A');
    clearSyncOwner(storage);
    expect(readSyncOwner(storage)).toBeNull();
    expect(readSyncOwner(null)).toBeNull();
  });
});
