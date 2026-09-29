import { describe, expect, it, vi } from 'vitest';
import { genreSearch, loadGenrePage, parseGenreQuery } from './genre';
import { createMockTmdb } from './tmdb/mock';

describe('parseGenreQuery', () => {
  it('parses id, page and sort', () => {
    expect(parseGenreQuery('28', new URLSearchParams('page=3&sort=date'))).toEqual({ genreId: 28, page: 3, sortBy: 'date' });
  });
  it('falls back to defaults on junk', () => {
    expect(parseGenreQuery('abc', new URLSearchParams('page=-2&sort=evil'))).toEqual({
      genreId: null,
      page: 1,
      sortBy: 'popularity',
    });
    expect(parseGenreQuery(undefined, new URLSearchParams('page=1.5')).page).toBe(1);
    expect(parseGenreQuery('0', new URLSearchParams()).genreId).toBeNull();
  });
});

describe('genreSearch', () => {
  it('omits defaults', () => {
    expect(genreSearch(1, 'popularity')).toBe('');
    expect(genreSearch(2, 'rating')).toBe('?sort=rating&page=2');
  });
});

describe('loadGenrePage', () => {
  it('loads a known genre on the mock adapter', async () => {
    const data = await loadGenrePage(878, 1, 'rating', createMockTmdb());
    expect(data.genre?.name).toBe('Science Fiction');
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((m) => m.genres.includes('Science Fiction'))).toBe(true);
    expect(data.totalResults).toBeGreaterThanOrEqual(data.items.length);
  });

  it('returns genre null for an unknown id without calling discover', async () => {
    const svc = createMockTmdb();
    const spy = vi.spyOn(svc, 'discover');
    const data = await loadGenrePage(424242, 1, 'popularity', svc);
    expect(data.genre).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('re-sorts client-side when an adapter ignores sortBy', async () => {
    const base = createMockTmdb();
    const ignoring = {
      ...base,
      discover: (o: Parameters<typeof base.discover>[0]) => base.discover({ ...o, sortBy: undefined }),
    };
    const data = await loadGenrePage(18, 1, 'date', ignoring);
    const years = data.items.map((m) => m.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });
});
