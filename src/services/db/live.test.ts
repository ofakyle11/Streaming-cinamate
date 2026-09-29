import { describe, expect, it, vi } from 'vitest';
import { NotConfiguredError, type SyncChange } from '../types';
import {
  createLiveDb,
  historyFromDb,
  isPushable,
  profileFromDb,
  ratingFromDb,
  SYNC_CONFLICT_COLUMNS,
  toDbRow,
  type SupabaseDbLike,
} from './live';

type Rows = Record<string, Record<string, unknown>[]>;

/** Minimal PostgREST query-builder fake: select/eq/order/range and upsert. */
function fakeClient(tables: Rows = {}, opts: { upsertError?: string; selectError?: string } = {}) {
  const upsert = vi.fn<(rows: unknown[], o: unknown) => Promise<{ error: { message: string } | null }>>(async () => ({ error: opts.upsertError ? { message: opts.upsertError } : null }));
  const ranges: Array<[string, number, number]> = [];
  const eqs: Array<[string, string, unknown]> = [];
  const from = vi.fn((table: string) => {
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => {
        eqs.push([table, col, v]);
        return q;
      },
      order: () => q,
      range: async (a: number, b: number) => {
        ranges.push([table, a, b]);
        if (opts.selectError) return { data: null, error: { message: opts.selectError } };
        return { data: (tables[table] ?? []).slice(a, b + 1), error: null };
      },
      upsert: (rows: unknown[], o: unknown) => upsert(rows, o),
    };
    return q;
  });
  return { client: { from } as unknown as SupabaseDbLike, from, upsert, ranges, eqs };
}

const make = (fake: ReturnType<typeof fakeClient>, pageSize?: number) =>
  createLiveDb('https://proj.supabase.co', 'anon-key', { loadClient: async () => fake.client, pageSize });

const iso = (ms: number) => new Date(ms).toISOString();

describe('live DB row mapping', () => {
  it('maps changes to snake_case rows owned by the user', () => {
    const change: SyncChange = {
      table: 'history',
      row: { profileId: 'p1', titleId: 5, position: -3, duration: 60, lastWatchedAt: 1_000, completed: false, updatedAt: 2_000, deleted: false },
    };
    expect(toDbRow('u1', change)).toEqual({
      user_id: 'u1',
      profile_id: 'p1',
      title_id: 5,
      position: 0,
      duration: 60,
      last_watched_at: iso(1_000),
      completed: false,
      updated_at: iso(2_000),
      deleted: false,
    });
  });

  it('fits profile rows to the schema limits', () => {
    const row = toDbRow('u1', {
      table: 'profiles',
      row: { profileId: 'p', name: '   ', avatar: 'a'.repeat(40), kid: true, createdAt: 0, updatedAt: 0, deleted: false },
    });
    expect(row).toMatchObject({ id: 'p', name: 'Profile', kid: true });
    expect((row.avatar as string).length).toBe(32);
  });

  it('maps DB rows back to domain rows', () => {
    expect(
      profileFromDb({ id: 'p1', name: 'Ada', avatar: 'dusk', kid: true, created_at: iso(10), updated_at: iso(20), deleted: false }),
    ).toEqual({ profileId: 'p1', name: 'Ada', avatar: 'dusk', kid: true, createdAt: 10, updatedAt: 20, deleted: false });
    expect(
      historyFromDb({ profile_id: 'p1', title_id: 3, position: '12.5', duration: 100, last_watched_at: iso(5), completed: true, updated_at: iso(6), deleted: true }),
    ).toMatchObject({ titleId: 3, position: 12.5, completed: true, lastWatchedAt: 5, deleted: true });
    expect(ratingFromDb({ profile_id: 'p1', title_id: 3, rating: 9, rated_at: iso(1), updated_at: iso(1) })).toBeNull();
  });

  it('rejects rows the schema would refuse', () => {
    const w = (titleId: number, profileId = 'p1'): SyncChange => ({
      table: 'watchlist',
      row: { profileId, titleId, addedAt: 0, updatedAt: 0, deleted: false },
    });
    expect(isPushable(w(1))).toBe(true);
    expect(isPushable(w(0))).toBe(false);
    expect(isPushable(w(1.5))).toBe(false);
    expect(isPushable(w(1, ''))).toBe(false);
    expect(isPushable(w(1, 'x'.repeat(65)))).toBe(false);
  });
});

describe('live DB adapter (Supabase)', () => {
  it('pulls every table for the user, paging past the row cap', async () => {
    const watchlist = Array.from({ length: 5 }, (_, i) => ({
      profile_id: 'p1',
      title_id: i + 1,
      added_at: iso(i),
      updated_at: iso(i),
      deleted: false,
    }));
    const fake = fakeClient({
      profiles: [{ id: 'p1', name: 'Ada', avatar: 'dusk', kid: false, created_at: iso(1), updated_at: iso(2), deleted: false }],
      watchlist,
      ratings: [{ profile_id: 'p1', title_id: 1, rating: 0, rated_at: iso(1), updated_at: iso(1), deleted: false }],
    });
    const snapshot = (await make(fake, 2).pullSnapshot('u1'))!;

    expect(snapshot.profiles).toHaveLength(1);
    expect(snapshot.watchlist.map((r) => r.titleId)).toEqual([1, 2, 3, 4, 5]);
    expect(snapshot.history).toEqual([]);
    expect(snapshot.ratings).toEqual([]); // invalid rating dropped
    expect(fake.ranges.filter(([t]) => t === 'watchlist')).toEqual([
      ['watchlist', 0, 1],
      ['watchlist', 2, 3],
      ['watchlist', 4, 5],
    ]);
    expect(fake.eqs.every(([, col, v]) => col === 'user_id' && v === 'u1')).toBe(true);
  });

  it('upserts grouped by table, profiles first, keyed on the primary key', async () => {
    const fake = fakeClient();
    await make(fake).pushChanges('u1', [
      { table: 'ratings', row: { profileId: 'p1', titleId: 1, rating: 4, ratedAt: 1, updatedAt: 1, deleted: false } },
      { table: 'profiles', row: { profileId: 'p1', name: 'Ada', avatar: '', kid: false, createdAt: 1, updatedAt: 1, deleted: false } },
      { table: 'ratings', row: { profileId: 'p1', titleId: 2, rating: 5, ratedAt: 1, updatedAt: 1, deleted: true } },
      { table: 'watchlist', row: { profileId: 'p1', titleId: -1, addedAt: 1, updatedAt: 1, deleted: false } },
    ]);
    expect(fake.from.mock.calls.map(([t]) => t)).toEqual(['profiles', 'ratings']);
    expect(fake.upsert.mock.calls[0][1]).toEqual({ onConflict: SYNC_CONFLICT_COLUMNS.profiles });
    expect(fake.upsert.mock.calls[1][0]).toHaveLength(2);
    expect(fake.upsert.mock.calls[1][0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ user_id: 'u1', title_id: 2, deleted: true })]),
    );
  });

  it('does nothing for an empty push', async () => {
    const fake = fakeClient();
    await make(fake).pushChanges('u1', []);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('surfaces Supabase errors so the engine can retry', async () => {
    await expect(make(fakeClient({}, { selectError: 'JWT expired' })).pullSnapshot('u1')).rejects.toThrow('JWT expired');
    await expect(
      make(fakeClient({}, { upsertError: 'violates row-level security' })).pushChanges('u1', [
        { table: 'profiles', row: { profileId: 'p1', name: 'A', avatar: '', kid: false, createdAt: 1, updatedAt: 1, deleted: false } },
      ]),
    ).rejects.toThrow('row-level security');
  });

  it('rejects instead of crashing when not configured, and keeps legacy calls explicit', async () => {
    const db = createLiveDb('', '');
    await expect(db.pullSnapshot('u1')).rejects.toBeInstanceOf(NotConfiguredError);
    await expect(createLiveDb('https://x', 'k', { loadClient: async () => fakeClient().client }).getProfile('u1')).rejects.toBeInstanceOf(
      NotConfiguredError,
    );
  });
});
