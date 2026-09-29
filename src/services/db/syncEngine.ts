/**
 * Cloud sync engine: keeps the local zustand store and the DB adapter in step
 * while a user is signed in.
 *
 *   start -> initial pull -> last-write-wins merge -> apply to store + push local winners
 *   store change -> diff -> pending queue (persisted) -> debounced upsert
 *
 * With the mock DB adapter `pullSnapshot` resolves `null` and the engine turns
 * itself off, so guests and mock mode never touch the network.
 */
import type { DbService, SyncChange } from '../types';
import { adoptSnapshot, diffStates, mergeSnapshots, rowKey, type SyncableState } from './sync';

export type SyncStatus = 'idle' | 'pulling' | 'synced' | 'pending' | 'pushing' | 'error' | 'disabled' | 'stopped';

/** The subset of a zustand store the engine needs. */
export interface SyncStore<S extends SyncableState = SyncableState> {
  getState(): S;
  setState(partial: Partial<S>): void;
  subscribe(listener: (state: S, prev: S) => void): () => void;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface CloudSyncOptions<S extends SyncableState = SyncableState> {
  db: Pick<DbService, 'pullSnapshot' | 'pushChanges'>;
  store: SyncStore<S>;
  /** Quiet period before local edits are upserted. */
  debounceMs?: number;
  /** Retry delays after a failed pull/push; the last one repeats. */
  retryDelaysMs?: readonly number[];
  now?: () => number;
  /** Where unsent edits survive reloads; defaults to localStorage (null = memory only). */
  storage?: KeyValueStorage | null;
  onStatus?: (status: SyncStatus) => void;
  /** Flush when the page is hidden/closed. Default true in browsers. */
  flushOnHide?: boolean;
}

export interface StopOptions {
  /** Try to upload unsent edits before stopping (default true). */
  flush?: boolean;
  /** Forget unsent edits, including the persisted queue (used when deleting account data). */
  discard?: boolean;
}

export interface CloudSync {
  readonly status: SyncStatus;
  /**
   * True once the store holds this account's cloud data (the initial merge has
   * been applied). The caller should reset the local data on sign-out then, so
   * it never lingers on the device as guest data.
   */
  readonly linked: boolean;
  /** Resolves once the initial pull + merge has finished (or sync turned off). */
  readonly ready: Promise<void>;
  /** Upload pending edits now. */
  flush(): Promise<void>;
  stop(opts?: StopOptions): Promise<void>;
}

export const DEFAULT_DEBOUNCE_MS = 1200;
export const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 60_000] as const;

/** localStorage key for a user's unsent edits (the `lf.` prefix is wiped by "delete my data"). */
export const pendingStorageKey = (userId: string) => `lf.sync.pending.${userId}`;

/**
 * localStorage key naming the account whose cloud data the local store holds.
 * Unset means the local data is guest data, which may be merged into the first
 * account that signs in. When it names another account, that account's data
 * is replaced by the server snapshot and never uploaded.
 */
export const SYNC_OWNER_KEY = 'lf.sync.owner';

/** The account the local store data belongs to, or null for guest data / unknown. */
export function readSyncOwner(storage: KeyValueStorage | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(SYNC_OWNER_KEY) || null;
  } catch {
    return null;
  }
}

/** Mark the local store data as guest data again (after it was reset). */
export function clearSyncOwner(storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SYNC_OWNER_KEY);
  } catch {
    /* storage unavailable */
  }
}

function writeSyncOwner(storage: KeyValueStorage | null, userId: string): void {
  try {
    storage?.setItem(SYNC_OWNER_KEY, userId);
  } catch {
    /* storage unavailable: sign-out still resets the store via `linked` */
  }
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isChange(v: unknown): v is SyncChange {
  if (!v || typeof v !== 'object') return false;
  const c = v as { table?: unknown; row?: unknown };
  const row = c.row as { profileId?: unknown; updatedAt?: unknown; deleted?: unknown } | undefined;
  return (
    (c.table === 'profiles' || c.table === 'watchlist' || c.table === 'history' || c.table === 'ratings') &&
    !!row &&
    typeof row.profileId === 'string' &&
    typeof row.updatedAt === 'number' &&
    typeof row.deleted === 'boolean'
  );
}

function loadPending(storage: KeyValueStorage | null, key: string): Map<string, SyncChange> {
  const out = new Map<string, SyncChange>();
  if (!storage) return out;
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) parsed.filter(isChange).forEach((c) => out.set(rowKey(c), c));
  } catch {
    /* corrupt or unavailable: start clean */
  }
  return out;
}

/** Start syncing the store for `userId`. Call `stop()` on sign-out. */
export function startCloudSync<S extends SyncableState>(userId: string, opts: CloudSyncOptions<S>): CloudSync {
  const {
    db,
    store,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    now = Date.now,
    onStatus,
  } = opts;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const storageKey = pendingStorageKey(userId);

  let pending = loadPending(storage, storageKey);
  // This account's own unsent edits from earlier sessions. Edits made before
  // the initial pull are made over whatever the store held, which may be
  // another account's data, so only these survive an ownership change.
  const restoredPending: ReadonlyMap<string, SyncChange> = new Map(pending);
  let status: SyncStatus = 'idle';
  let stopped = false;
  let merged = false; // initial pull applied; pushes are allowed
  let applying = false; // suppress echo while writing remote data into the store
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let inFlight: Promise<void> | null = null;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const setStatus = (s: SyncStatus) => {
    if (status === s) return;
    status = s;
    try {
      onStatus?.(s);
    } catch {
      /* listener errors never break sync */
    }
  };

  const persist = () => {
    if (!storage) return;
    try {
      if (pending.size === 0) storage.removeItem(storageKey);
      else storage.setItem(storageKey, JSON.stringify([...pending.values()]));
    } catch {
      /* quota / blocked storage: keep going in memory */
    }
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const retryDelay = () => retryDelaysMs[Math.min(failures - 1, retryDelaysMs.length - 1)] ?? 60_000;

  const schedule = (delay: number, fn: () => void) => {
    clearTimer();
    if (stopped) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delay);
  };

  const doFlush = async (): Promise<void> => {
    if (!merged || stopped || pending.size === 0) return;
    const batch = new Map(pending);
    setStatus('pushing');
    try {
      await db.pushChanges(userId, [...batch.values()]);
      failures = 0;
      // Drop only what was sent; edits made during the request stay queued.
      for (const [key, c] of batch) if (pending.get(key) === c) pending.delete(key);
      persist();
      if (pending.size > 0) {
        setStatus('pending');
        schedule(debounceMs, () => void flush());
      } else {
        setStatus('synced');
      }
    } catch {
      failures += 1;
      setStatus('error');
      schedule(retryDelay(), () => void flush());
    }
  };

  const flush = (): Promise<void> => {
    clearTimer();
    if (inFlight) {
      // Chain one more run after the current request so late edits go out too.
      return inFlight.then(() => flush());
    }
    inFlight = doFlush().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const unsubscribe = store.subscribe((next, prev) => {
    if (applying || stopped) return;
    const changes = diffStates(prev, next, now());
    if (changes.length === 0) return;
    for (const c of changes) pending.set(rowKey(c), c);
    persist();
    if (merged) {
      setStatus('pending');
      schedule(debounceMs, () => void flush());
    }
  });

  const onHide = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') void flush();
  };
  const onPageHide = () => void flush();
  const listenHide = (opts.flushOnHide ?? true) && typeof window !== 'undefined';
  if (listenHide) {
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
  }
  const removeHideListeners = () => {
    if (!listenHide) return;
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  };

  const teardown = () => {
    resolveReady();
    stopped = true;
    clearTimer();
    unsubscribe();
    removeHideListeners();
  };

  const pull = async (): Promise<void> => {
    if (stopped) return;
    setStatus('pulling');
    let remote;
    try {
      remote = await db.pullSnapshot(userId);
    } catch {
      if (stopped) return;
      failures += 1;
      setStatus('error');
      // Keep queueing local edits; retry the initial pull with backoff.
      schedule(retryDelay(), () => void pull());
      return;
    }
    if (stopped) return;
    if (remote === null) {
      // No remote store (mock mode): sync is off, local store stays authoritative.
      teardown();
      pending = new Map();
      persist();
      setStatus('disabled');
      resolveReady();
      return;
    }
    failures = 0;
    const owner = readSyncOwner(storage);
    const result =
      owner !== null && owner !== userId
        ? adoptSnapshot(remote, restoredPending, now())
        : mergeSnapshots(store.getState(), remote, pending, now());
    applying = true;
    try {
      store.setState(result.state as Partial<S>);
    } finally {
      applying = false;
    }
    pending = new Map(result.push.map((c) => [rowKey(c), c]));
    persist();
    writeSyncOwner(storage, userId);
    merged = true;
    resolveReady();
    if (pending.size > 0) await flush();
    else setStatus('synced');
  };

  void pull();

  return {
    get status() {
      return status;
    },
    get linked() {
      return merged;
    },
    ready,
    flush,
    async stop(stopOpts: StopOptions = {}) {
      if (stopOpts.discard) {
        teardown();
        pending = new Map();
        persist();
        setStatus('stopped');
        return;
      }
      if (stopOpts.flush !== false && merged && !stopped) {
        try {
          await flush();
        } catch {
          /* best effort; the queue is persisted for next sign-in */
        }
      }
      teardown();
      setStatus('stopped');
    },
  };
}
