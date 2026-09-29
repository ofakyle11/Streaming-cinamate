import type { SupabaseClient } from '@supabase/supabase-js';
import {
  NotConfiguredError,
  type DbService,
  type SyncChange,
  type SyncHistoryRow,
  type SyncProfileRow,
  type SyncRatingRow,
  type SyncSnapshot,
  type SyncTable,
  type SyncWatchlistRow,
} from '../types';

/** The slice of the Supabase client this adapter uses; lets tests inject a fake. */
export type SupabaseDbLike = Pick<SupabaseClient, 'from'>;

export interface LiveDbOptions {
  /** Returns the (shared) Supabase client. Defaults to a lazy import of the SDK. */
  loadClient?: () => Promise<SupabaseDbLike>;
  /** Rows per request when pulling (PostgREST caps responses, 1000 by default). */
  pageSize?: number;
}

/** Primary-key columns per table, used as the upsert conflict target (see supabase/schema.sql). */
export const SYNC_CONFLICT_COLUMNS: Record<SyncTable, string> = {
  profiles: 'user_id,id',
  watchlist: 'user_id,profile_id,title_id',
  history: 'user_id,profile_id,title_id',
  ratings: 'user_id,profile_id,title_id',
};

/** Every per-user cloud sync table (see supabase/schema.sql). */
export const SYNC_TABLES: readonly SyncTable[] = ['profiles', 'watchlist', 'history', 'ratings'];

/* ------------------------------------------------------------- row mapping */

type DbRow = Record<string, unknown>;

const iso = (ms: number) => new Date(Number.isFinite(ms) ? ms : 0).toISOString();

function ms(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Domain change -> snake_case row for the given user. */
export function toDbRow(userId: string, change: SyncChange): DbRow {
  const base = { user_id: userId, updated_at: iso(change.row.updatedAt), deleted: change.row.deleted };
  switch (change.table) {
    case 'profiles': {
      const r = change.row;
      // Fit the table's CHECK constraints so one odd row cannot fail a whole batch.
      const name = Array.from(r.name.trim()).slice(0, 50).join('') || 'Profile';
      const avatar = Array.from(r.avatar).slice(0, 32).join('');
      return { ...base, id: r.profileId, name, avatar, kid: r.kid, created_at: iso(r.createdAt) };
    }
    case 'watchlist': {
      const r = change.row;
      return { ...base, profile_id: r.profileId, title_id: r.titleId, added_at: iso(r.addedAt) };
    }
    case 'history': {
      const r = change.row;
      return {
        ...base,
        profile_id: r.profileId,
        title_id: r.titleId,
        position: Math.max(0, r.position),
        duration: Math.max(0, r.duration),
        last_watched_at: iso(r.lastWatchedAt),
        completed: r.completed,
      };
    }
    case 'ratings': {
      const r = change.row;
      return { ...base, profile_id: r.profileId, title_id: r.titleId, rating: r.rating, rated_at: iso(r.ratedAt) };
    }
  }
}

export function profileFromDb(r: DbRow): SyncProfileRow {
  return {
    profileId: text(r.id),
    name: text(r.name),
    avatar: text(r.avatar),
    kid: r.kid === true,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deleted: r.deleted === true,
  };
}

export function watchlistFromDb(r: DbRow): SyncWatchlistRow {
  return {
    profileId: text(r.profile_id),
    titleId: num(r.title_id),
    addedAt: ms(r.added_at),
    updatedAt: ms(r.updated_at),
    deleted: r.deleted === true,
  };
}

export function historyFromDb(r: DbRow): SyncHistoryRow {
  return {
    profileId: text(r.profile_id),
    titleId: num(r.title_id),
    position: num(r.position),
    duration: num(r.duration),
    lastWatchedAt: ms(r.last_watched_at),
    completed: r.completed === true,
    updatedAt: ms(r.updated_at),
    deleted: r.deleted === true,
  };
}

export function ratingFromDb(r: DbRow): SyncRatingRow | null {
  const rating = num(r.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return {
    profileId: text(r.profile_id),
    titleId: num(r.title_id),
    rating: rating as SyncRatingRow['rating'],
    ratedAt: ms(r.rated_at),
    updatedAt: ms(r.updated_at),
    deleted: r.deleted === true,
  };
}

/** Rows the schema would reject outright (bad keys or values) are skipped, not retried forever. */
export function isPushable(c: SyncChange): boolean {
  const id = c.row.profileId;
  if (typeof id !== 'string' || id.length < 1 || id.length > 64) return false;
  if (c.table === 'profiles') return true;
  if (!Number.isInteger(c.row.titleId) || c.row.titleId <= 0 || c.row.titleId > 2_147_483_647) return false;
  if (c.table === 'ratings') return Number.isInteger(c.row.rating) && c.row.rating >= 1 && c.row.rating <= 5;
  if (c.table === 'history') return Number.isFinite(c.row.position) && Number.isFinite(c.row.duration);
  return true;
}

function asError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return new Error((err as { message: string }).message);
  }
  return new Error(fallback);
}

/* ------------------------------------------------------------- adapter */

/**
 * Live DB adapter (Supabase Postgres behind RLS; schema in supabase/schema.sql).
 * Implements the cloud-sync contract used by the sync engine. The legacy
 * per-entry methods have no backing tables and reject with NotConfiguredError.
 */
export function createLiveDb(supabaseUrl: string, anonKey: string, opts: LiveDbOptions = {}): DbService {
  const pageSize = Math.max(1, opts.pageSize ?? 1000);
  const loadClient =
    opts.loadClient ??
    (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(supabaseUrl, anonKey);
    });

  let clientPromise: Promise<SupabaseDbLike> | null = null;
  const client = (): Promise<SupabaseDbLike> => {
    if (!supabaseUrl || !anonKey) {
      return Promise.reject(new NotConfiguredError('DB', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'));
    }
    if (!clientPromise) {
      clientPromise = loadClient().catch((err: unknown) => {
        clientPromise = null;
        throw asError(err, 'Could not reach the database.');
      });
    }
    return clientPromise;
  };

  async function selectAll(sb: SupabaseDbLike, table: SyncTable, userId: string): Promise<DbRow[]> {
    const rows: DbRow[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await sb
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw asError(error, `Could not load ${table}.`);
      const page = (data ?? []) as DbRow[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  const legacy = (): never => {
    throw new NotConfiguredError('DB', 'a table for this call (live DB only implements cloud sync)');
  };

  return {
    getProfile: async () => legacy(),
    upsertProfile: async () => legacy(),
    listEntries: async () => legacy(),
    addToList: async () => legacy(),
    removeFromList: async () => legacy(),
    getProgress: async () => legacy(),
    setProgress: async () => legacy(),

    async pullSnapshot(userId): Promise<SyncSnapshot> {
      const sb = await client();
      const [profiles, watchlist, history, ratings] = await Promise.all(
        SYNC_TABLES.map((t) => selectAll(sb, t, userId)),
      );
      return {
        profiles: profiles.map(profileFromDb).filter((r) => r.profileId),
        watchlist: watchlist.map(watchlistFromDb).filter((r) => r.profileId && r.titleId > 0),
        history: history.map(historyFromDb).filter((r) => r.profileId && r.titleId > 0),
        ratings: ratings
          .map(ratingFromDb)
          .filter((r): r is SyncRatingRow => r !== null && Boolean(r.profileId) && r.titleId > 0),
      };
    },

    async pushChanges(userId, changes) {
      if (changes.length === 0) return;
      const sb = await client();
      const byTable = new Map<SyncTable, DbRow[]>();
      for (const c of changes.filter(isPushable)) {
        const list = byTable.get(c.table) ?? [];
        list.push(toDbRow(userId, c));
        byTable.set(c.table, list);
      }
      // Profiles first so a new profile exists before its rows arrive.
      for (const table of SYNC_TABLES) {
        const rows = byTable.get(table);
        if (!rows?.length) continue;
        const { error } = await sb.from(table).upsert(rows, { onConflict: SYNC_CONFLICT_COLUMNS[table] });
        if (error) throw asError(error, `Could not save ${table}.`);
      }
    },
  };
}
