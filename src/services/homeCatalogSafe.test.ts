import { describe, expect, it } from 'vitest';
import { loadHomeCatalogSafe } from './discovery';
import { createMockTmdb } from './tmdb/mock';
import type { TmdbService } from './types';

const empty = { page: 1, results: [], total_pages: 0, total_results: 0 };
const fail = (status: number) => () => Promise.reject(new Error(`TMDB ${status}`));

describe('loadHomeCatalogSafe', () => {
  it('returns all four rows on the mock adapter', async () => {
    const { featured, rows } = await loadHomeCatalogSafe(createMockTmdb());
    expect(rows.map((r) => r.title)).toEqual(['Trending Now', 'Top Picks for You', 'New Releases', 'Sci-Fi & Beyond']);
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.length).toBeLessThanOrEqual(5);
    for (const r of rows) expect(r.items.length).toBeLessThanOrEqual(10);
  });

  it('returns the remaining rows when one method rejects', async () => {
    const base = createMockTmdb();
    const { featured, rows } = await loadHomeCatalogSafe({ ...base, nowPlaying: fail(502) });
    expect(rows.map((r) => r.title)).toEqual(['Trending Now', 'Top Picks for You', 'Sci-Fi & Beyond']);
    expect(featured.length).toBeGreaterThan(0);
  });

  it('survives a failing genres call and a synchronous throw', async () => {
    const base = createMockTmdb();
    const svc: TmdbService = {
      ...base,
      genres: fail(429),
      discover: () => {
        throw new Error('sync boom');
      },
    };
    const { rows } = await loadHomeCatalogSafe(svc);
    expect(rows.map((r) => r.title)).toEqual(['Trending Now', 'Top Picks for You', 'New Releases']);
    expect(rows[0].items.every((m) => m.genres.length === 0)).toBe(true);
  });

  it('falls back to popular TV for featured when trending is empty', async () => {
    const base = createMockTmdb();
    const { featured, rows } = await loadHomeCatalogSafe({ ...base, trending: async () => empty });
    expect(rows.find((r) => r.title === 'Trending Now')).toBeUndefined();
    const topPicks = rows.find((r) => r.title === 'Top Picks for You');
    expect(featured.length).toBeGreaterThan(0);
    expect(featured[0].id).toBe(topPicks?.items[0].id);
    expect(featured.every((m) => m.mediaType === 'tv')).toBe(true);
  });

  it('falls back to now playing when trending and popular TV both fail', async () => {
    const base = createMockTmdb();
    const { featured, rows } = await loadHomeCatalogSafe({ ...base, trending: fail(504), popular: fail(504) });
    const newReleases = rows.find((r) => r.title === 'New Releases');
    expect(featured[0].id).toBe(newReleases?.items[0].id);
  });

  it('throws when every method rejects', async () => {
    const base = createMockTmdb();
    const svc: TmdbService = {
      ...base,
      trending: fail(429),
      popular: fail(502),
      nowPlaying: fail(504),
      discover: fail(502),
    };
    await expect(loadHomeCatalogSafe(svc)).rejects.toThrow('TMDB 429');
  });

  it('throws when every source is empty', async () => {
    const base = createMockTmdb();
    const e = async () => empty;
    await expect(
      loadHomeCatalogSafe({ ...base, trending: e, popular: e, nowPlaying: e, discover: e }),
    ).rejects.toThrow(/empty/);
  });
});
