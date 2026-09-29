import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockTmdb, MOCK_GENRES } from '../../services/tmdb/mock';
import type { TmdbPage, TmdbService, TmdbTitle } from '../../services/types';
import { EMPTY_FILTERS, type SearchFilters } from './filters';
import {
  AUTO_FILL_MAX_EXTRA_PAGES,
  fetchSearchPage,
  mergeByPopularity,
  toSearchFilters,
  useInfiniteSearch,
} from './useInfiniteSearch';

const title = (id: number, over: Partial<TmdbTitle> = {}): TmdbTitle => ({
  id,
  media_type: 'movie',
  title: `T${id}`,
  overview: '',
  poster_path: '',
  backdrop_path: '',
  genre_ids: [28],
  vote_average: 7,
  release_date: '2020-01-01',
  runtime: 90,
  ...over,
});

const pageOf = (results: TmdbTitle[], page: number, total_pages: number): TmdbPage<TmdbTitle> => ({
  page,
  results,
  total_pages,
  total_results: total_pages * 20,
});

/** Stub service built on the mock; tests override the methods they exercise. */
function stubSvc(over: Partial<TmdbService>): TmdbService {
  return { ...createMockTmdb(), genres: async () => MOCK_GENRES, ...over };
}

const f = (over: Partial<SearchFilters>): SearchFilters => ({ ...EMPTY_FILTERS, ...over });

describe('toSearchFilters', () => {
  it('pushes type / genre / rating, and year only for a single-year range', () => {
    expect(toSearchFilters(f({ type: 'tv', genreId: 18, minRating: 7 }))).toEqual({
      mediaType: 'tv',
      genreId: 18,
      minRating: 7,
    });
    expect(toSearchFilters(f({ yearFrom: 2001, yearTo: 2001 }))).toEqual({ year: 2001 });
    expect(toSearchFilters(f({ yearFrom: 2001, yearTo: 2005 }))).toEqual({});
    expect(toSearchFilters(EMPTY_FILTERS)).toEqual({});
  });
});

describe('mergeByPopularity', () => {
  it('interleaves two sorted pages by popularity', () => {
    const a = [
      title(1, { popularity: 90 }),
      title(2, { popularity: 50 }),
      title(3, { popularity: 10 }),
    ];
    const b = [title(4, { popularity: 70 }), title(5, { popularity: 50 })];
    expect(mergeByPopularity(a, b).map((t) => t.id)).toEqual([1, 4, 2, 5, 3]);
  });
});

describe('fetchSearchPage', () => {
  it('passes filters to search and still filters client-side', async () => {
    const search = vi.fn<TmdbService['search']>(async () =>
      pageOf([title(1, { vote_average: 9 }), title(2, { vote_average: 5 })], 1, 1),
    );
    const svc = stubSvc({ search });
    const res = await fetchSearchPage(
      svc,
      ' neon ',
      f({ type: 'movie', minRating: 8, yearFrom: 2020, yearTo: 2020 }),
      1,
    );
    expect(search).toHaveBeenCalledWith('neon', 1, {
      mediaType: 'movie',
      minRating: 8,
      year: 2020,
    });
    expect(res.results.map((t) => t.id)).toEqual([1]);
  });

  it('passes every filter to discover for a typed empty query', async () => {
    const discover = vi.fn<TmdbService['discover']>(async () => pageOf([], 2, 3));
    const svc = stubSvc({ discover });
    await fetchSearchPage(
      svc,
      '',
      f({ type: 'tv', genreId: 18, yearFrom: 2000, yearTo: 2010, minRating: 6 }),
      2,
    );
    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover).toHaveBeenCalledWith({
      mediaType: 'tv',
      genreId: 18,
      yearFrom: 2000,
      yearTo: 2010,
      minRating: 6,
      page: 2,
    });
  });

  it('merges movie and TV discover pages for an empty untyped query', async () => {
    const discover = vi.fn(async (opts: Parameters<TmdbService['discover']>[0]) =>
      opts.mediaType === 'tv'
        ? pageOf(
            [
              title(10, { media_type: 'tv', popularity: 80 }),
              title(11, { media_type: 'tv', popularity: 20 }),
            ],
            opts.page ?? 1,
            5,
          )
        : pageOf([title(1, { popularity: 90 }), title(2, { popularity: 40 })], opts.page ?? 1, 2),
    );
    const svc = stubSvc({ discover });
    const res = await fetchSearchPage(svc, '', f({ minRating: 6 }), 1);
    expect(discover).toHaveBeenCalledTimes(2);
    expect(discover.mock.calls.map((c) => c[0].mediaType).sort()).toEqual(['movie', 'tv']);
    expect(discover.mock.calls[0][0]).toMatchObject({
      minRating: 6,
      sortBy: 'popularity',
      page: 1,
    });
    expect(res.results.map((t) => t.id)).toEqual([1, 10, 2, 11]);
    expect(res.totalPages).toBe(5);
  });

  it('drops the exhausted side instead of repeating a clamped page', async () => {
    const svc = stubSvc({
      discover: async (opts) =>
        opts.mediaType === 'tv'
          ? pageOf([title(10, { media_type: 'tv' })], opts.page ?? 1, 3)
          : pageOf([title(1)], 1, 1), // adapter clamped back to page 1
    });
    const res = await fetchSearchPage(svc, '', EMPTY_FILTERS, 2);
    expect(res.results.map((t) => t.id)).toEqual([10]);
    expect(res.page).toBe(2);
  });

  it('browses movies and TV together with the mock adapter', async () => {
    const res = await fetchSearchPage(createMockTmdb(), '', EMPTY_FILTERS, 1);
    expect(new Set(res.results.map((t) => t.media_type))).toEqual(new Set(['movie', 'tv']));
  });
});

describe('useInfiniteSearch auto-fill', () => {
  it('fetches the next page automatically when a page filters to nothing', async () => {
    const search = vi.fn(async (_q: string, page = 1) =>
      page === 1
        ? pageOf([title(1, { vote_average: 3 }), title(2, { vote_average: 4 })], 1, 4)
        : pageOf(
            Array.from({ length: 10 }, (_, i) => title(page * 100 + i, { vote_average: 9 })),
            page,
            4,
          ),
    );
    const svc = stubSvc({ search });
    const filters = f({ minRating: 8 });
    const { result } = renderHook(() => useInfiniteSearch('x', filters, svc));
    await waitFor(() => expect(result.current.items.length).toBe(10));
    expect(result.current.status).toBe('ready');
    expect(search.mock.calls.map((c) => c[1])).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
  });

  it('caps automatic fetches at a few extra pages per trigger', async () => {
    const search = vi.fn(async (_q: string, page = 1) =>
      pageOf([title(page, { vote_average: 1 })], page, 20),
    );
    const svc = stubSvc({ search });
    const filters = f({ minRating: 8 });
    const { result } = renderHook(() => useInfiniteSearch('x', filters, svc));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1 + AUTO_FILL_MAX_EXTRA_PAGES));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(true);

    // A manual "load more" starts a fresh auto-fill budget.
    act(() => result.current.loadMore());
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2 * (1 + AUTO_FILL_MAX_EXTRA_PAGES)));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

describe('TMDB page limit', () => {
  it('reports hasMore false on page 500 of 500', async () => {
    const results = Array.from({ length: 10 }, (_, i) => title(i + 1));
    const search = vi.fn(async () => pageOf(results, 500, 500));
    const svc = stubSvc({ search });
    const { result } = renderHook(() => useInfiniteSearch('x', EMPTY_FILTERS, svc));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items.length).toBe(10);
    expect(result.current.hasMore).toBe(false);
  });

  it('clamps totalPages to 500 for search and the merged empty-query discover', async () => {
    const search = vi.fn(async () => pageOf([title(1)], 1, 40000));
    const discover = vi.fn<TmdbService['discover']>(async (o = {}) =>
      pageOf([title(o.mediaType === 'tv' ? 2 : 1, { media_type: o.mediaType ?? 'movie' })], 1, 9999),
    );
    const svc = stubSvc({ search, discover });
    expect((await fetchSearchPage(svc, 'x', EMPTY_FILTERS, 1)).totalPages).toBe(500);
    expect((await fetchSearchPage(svc, '', EMPTY_FILTERS, 1)).totalPages).toBe(500);
    expect((await fetchSearchPage(svc, '', f({ type: 'tv' }), 1)).totalPages).toBe(500);
  });
});
