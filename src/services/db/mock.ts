import type { DbService, ListEntry, ListKind, UserProfile, WatchProgress } from '../types';

const STORAGE_KEY = 'lf.mock.db';

interface Store {
  profiles: Record<string, UserProfile>;
  entries: ListEntry[];
  progress: WatchProgress[];
}

const empty = (): Store => ({ profiles: {}, entries: [], progress: [] });

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<Store>) } : empty();
  } catch {
    return empty();
  }
}

function persist(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** localStorage-backed DB. Mirrors the shape of the future Supabase tables. */
export function createMockDb(): DbService {
  const store = load();
  const save = () => persist(store);

  return {
    async getProfile(userId) {
      return store.profiles[userId] ?? null;
    },
    async upsertProfile(profile) {
      store.profiles[profile.userId] = { ...store.profiles[profile.userId], ...profile };
      save();
      return store.profiles[profile.userId];
    },
    async listEntries(userId, kind: ListKind) {
      return store.entries
        .filter((e) => e.userId === userId && e.kind === kind)
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    },
    async addToList(userId, kind, titleId, mediaType) {
      const existing = store.entries.find((e) => e.userId === userId && e.kind === kind && e.titleId === titleId);
      if (existing) return existing;
      const entry: ListEntry = { id: uid(), userId, kind, titleId, mediaType, addedAt: new Date().toISOString() };
      store.entries.push(entry);
      save();
      return entry;
    },
    async removeFromList(userId, kind, titleId) {
      const before = store.entries.length;
      store.entries = store.entries.filter((e) => !(e.userId === userId && e.kind === kind && e.titleId === titleId));
      if (store.entries.length !== before) save();
    },
    async getProgress(userId, titleId) {
      return store.progress.find((p) => p.userId === userId && p.titleId === titleId) ?? null;
    },
    async setProgress(progress) {
      const clamped = { ...progress, progress: Math.min(1, Math.max(0, progress.progress)) };
      const i = store.progress.findIndex((p) => p.userId === clamped.userId && p.titleId === clamped.titleId);
      if (i >= 0) store.progress[i] = clamped;
      else store.progress.push(clamped);
      save();
      return clamped;
    },
  };
}
