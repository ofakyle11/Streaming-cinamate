import { beforeEach, describe, expect, it } from 'vitest';
import { createMockDb } from './mock';

describe('mock DB adapter (no env vars)', () => {
  beforeEach(() => localStorage.clear());

  it('upserts and merges profiles, persisting across instances', async () => {
    const db = createMockDb();
    expect(await db.getProfile('u1')).toBeNull();
    await db.upsertProfile({ userId: 'u1', displayName: 'Ana' } as never);
    const merged = await db.upsertProfile({ userId: 'u1', plan: 'premium' } as never);
    expect(merged).toMatchObject({ userId: 'u1', displayName: 'Ana', plan: 'premium' });
    expect(await createMockDb().getProfile('u1')).toMatchObject({ displayName: 'Ana' });
  });

  it('adds list entries idempotently, filters by user/kind and removes', async () => {
    const db = createMockDb();
    const a = await db.addToList('u1', 'watchlist', 1, 'movie');
    const again = await db.addToList('u1', 'watchlist', 1, 'movie');
    expect(again.id).toBe(a.id);
    await db.addToList('u2', 'watchlist', 2, 'tv');
    expect(await db.listEntries('u1', 'watchlist')).toHaveLength(1);
    await db.removeFromList('u1', 'watchlist', 1);
    await db.removeFromList('u1', 'watchlist', 99);
    expect(await db.listEntries('u1', 'watchlist')).toEqual([]);
    expect(await createMockDb().listEntries('u2', 'watchlist')).toHaveLength(1);
  });

  it('clamps and replaces watch progress', async () => {
    const db = createMockDb();
    const p = await db.setProgress({ userId: 'u1', titleId: 5, progress: 1.7 } as never);
    expect(p.progress).toBe(1);
    await db.setProgress({ userId: 'u1', titleId: 5, progress: -2 } as never);
    expect((await db.getProgress('u1', 5))?.progress).toBe(0);
    expect(await db.getProgress('u1', 6)).toBeNull();
  });

  it('reports no remote snapshot and treats push as a no-op', async () => {
    const db = createMockDb() as unknown as {
      pullSnapshot: (u: string) => Promise<unknown>;
      pushChanges: (u: string, c: unknown) => Promise<unknown>;
    };
    expect(await db.pullSnapshot('u1')).toBeNull();
    await expect(db.pushChanges('u1', [])).resolves.toBeUndefined();
  });

  it('recovers from corrupt storage', async () => {
    localStorage.setItem('lf.mock.db', '{not json');
    expect(await createMockDb().listEntries('u1', 'watchlist')).toEqual([]);
  });
});
