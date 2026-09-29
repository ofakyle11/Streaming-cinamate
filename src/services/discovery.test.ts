import { describe, expect, it } from 'vitest';
import { loadNewPopular } from './discovery';
import { createMockTmdb } from './tmdb/mock';
import type { TmdbService } from './types';

describe('loadNewPopular', () => {
  it('returns non-empty rows from the mock adapter', async () => {
    const rows = await loadNewPopular(createMockTmdb());
    expect(rows.map((r) => r.title)).toEqual(['Trending This Week', 'Coming Soon', 'Now Playing', 'Popular TV']);
    for (const r of rows) {
      expect(r.items.length).toBeGreaterThan(0);
      expect(r.items[0].title).toBeTruthy();
    }
    expect(rows[3].items.every((m) => m.mediaType === 'tv')).toBe(true);
    // Genre names are resolved via genres().
    expect(rows[0].items.some((m) => m.genres.length > 0)).toBe(true);
  });

  it('asks for the weekly trending window', async () => {
    const base = createMockTmdb();
    const calls: unknown[] = [];
    const svc: TmdbService = {
      ...base,
      trending: (page, opts) => {
        calls.push([page, opts]);
        return base.trending(page, opts);
      },
    };
    await loadNewPopular(svc);
    expect(calls).toEqual([[1, { window: 'week' }]]);
  });

  it('drops empty rows and propagates errors', async () => {
    const base = createMockTmdb();
    const empty = { page: 1, results: [], total_pages: 0, total_results: 0 };
    const rows = await loadNewPopular({ ...base, upcoming: async () => empty });
    expect(rows.find((r) => r.title === 'Coming Soon')).toBeUndefined();
    expect(rows.length).toBe(3);
    await expect(loadNewPopular({ ...base, nowPlaying: () => Promise.reject(new Error('boom')) })).rejects.toThrow(
      'boom',
    );
  });
});
