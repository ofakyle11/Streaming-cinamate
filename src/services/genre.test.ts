import { describe, expect, it, vi } from 'vitest';
import { genreSearch, loadGenrePage, parseGenreQuery } from './genre';
import { createMockTmdb, MOCK_GENRES, MOCK_TITLES } from './tmdb/mock';

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

  it('includes type only when it differs from the default', () => {
    expect(genreSearch(1, 'popularity', 'movie', 'movie')).toBe('');
    expect(genreSearch(1, 'popularity', 'tv', 'tv')).toBe('');
    expect(genreSearch(1, 'popularity', 'tv', 'movie')).toBe('?type=tv');
    expect(genreSearch(3, 'date', 'movie', 'tv')).toBe('?sort=date&type=movie&page=3');
  });

  it('round-trips type through parseGenreQuery', () => {
    const parsed = parseGenreQuery('878', new URLSearchParams(genreSearch(2, 'rating', 'tv', 'movie')));
    expect(parsed).toEqual({ genreId: 878, page: 2, sortBy: 'rating', type: 'tv' });
    expect(parseGenreQuery('878', new URLSearchParams(genreSearch(1, 'popularity', 'movie', 'movie'))).type).toBeUndefined();
    expect(parseGenreQuery('878', new URLSearchParams('type=anime')).type).toBeUndefined();
  });
});

describe('mock genres(mediaType)', () => {
  it('keeps the no-arg list and filters per type by titles', async () => {
    const svc = createMockTmdb();
    expect(await svc.genres()).toBe(MOCK_GENRES);
    for (const type of ['movie', 'tv'] as const) {
      const list = await svc.genres(type);
      expect(list.length).toBeGreaterThan(0);
      for (const g of list) {
        expect(MOCK_TITLES.some((t) => t.media_type === type && t.genre_ids.includes(g.id))).toBe(true);
      }
    }
    expect((await svc.genres('movie')).map((g) => g.id)).not.toContain(37); // Western: TV only
    expect((await svc.genres('tv')).map((g) => g.id)).not.toContain(99); // Documentary: movies only
  });
});

describe('loadGenrePage media type', () => {
  it('uses movie for a movie-only genre', async () => {
    const svc = createMockTmdb();
    const spy = vi.spyOn(svc, 'discover');
    const data = await loadGenrePage(99, 1, 'popularity', svc);
    expect(data.availableTypes).toEqual(['movie']);
    expect(data.defaultType).toBe('movie');
    expect(data.mediaType).toBe('movie');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'movie', genreId: 99 }));
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((m) => m.mediaType === 'movie')).toBe(true);
  });

  it('uses tv for a TV-only genre (stub svc with split lists)', async () => {
    const base = createMockTmdb();
    const scifiFantasy = { id: 10765, name: 'Sci-Fi & Fantasy' };
    const tvTitle = { ...MOCK_TITLES.find((t) => t.media_type === 'tv')!, genre_ids: [10765] };
    const discover = vi.fn(async (o: Parameters<typeof base.discover>[0]) => ({
      page: 1,
      results: o.mediaType === 'tv' ? [tvTitle] : [],
      total_pages: 1,
      total_results: o.mediaType === 'tv' ? 1 : 0,
    }));
    const stub = {
      ...base,
      genres: async (t?: 'movie' | 'tv') =>
        t === 'movie' ? [{ id: 28, name: 'Action' }] : t === 'tv' ? [scifiFantasy] : [{ id: 28, name: 'Action' }, scifiFantasy],
      discover,
    };
    const data = await loadGenrePage(10765, 1, 'popularity', stub);
    expect(data.genre).toEqual(scifiFantasy);
    expect(data.availableTypes).toEqual(['tv']);
    expect(data.defaultType).toBe('tv');
    expect(data.mediaType).toBe('tv');
    expect(discover).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'tv', genreId: 10765 }));
    expect(data.items.map((m) => m.mediaType)).toEqual(['tv']);

    // An unavailable explicit type falls back to the default.
    const forced = await loadGenrePage(10765, 1, 'popularity', stub, 'movie');
    expect(forced.mediaType).toBe('tv');
  });

  it('defaults a shared genre to movie and honours an explicit tv type', async () => {
    const svc = createMockTmdb();
    const movies = await loadGenrePage(878, 1, 'popularity', svc);
    expect(movies.availableTypes).toEqual(['movie', 'tv']);
    expect(movies.defaultType).toBe('movie');
    expect(movies.items.every((m) => m.mediaType === 'movie')).toBe(true);

    const tv = await loadGenrePage(878, 1, 'popularity', svc, 'tv');
    expect(tv.mediaType).toBe('tv');
    expect(tv.defaultType).toBe('movie');
    expect(tv.items.length).toBeGreaterThan(0);
    expect(tv.items.every((m) => m.mediaType === 'tv')).toBe(true);
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
