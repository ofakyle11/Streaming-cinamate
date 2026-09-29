import { describe, expect, it } from 'vitest';
import type { TmdbTitle } from '../types';
import { isDiscoverSort, sortTitles, toTmdbSortParam } from './sort';
import { buildDiscoverPath } from './live';
import { createMockTmdb } from './mock';

const t = (id: number, vote_average: number, release_date: string, popularity?: number): TmdbTitle => ({
  id,
  media_type: 'movie',
  title: `T${id}`,
  overview: '',
  poster_path: '',
  backdrop_path: '',
  genre_ids: [],
  vote_average,
  release_date,
  runtime: 90,
  popularity,
});

const items = [t(1, 7, '2020-01-01', 50), t(2, 9, '2018-05-05', 10), t(3, 8, '2024-02-02', 90), t(4, 8, '2024-02-02', 90)];

describe('sortTitles', () => {
  it('sorts by popularity desc with id tie-break', () => {
    expect(sortTitles(items, 'popularity').map((x) => x.id)).toEqual([3, 4, 1, 2]);
  });
  it('sorts by rating desc', () => {
    expect(sortTitles(items, 'rating').map((x) => x.id)).toEqual([2, 3, 4, 1]);
  });
  it('sorts by date desc', () => {
    expect(sortTitles(items, 'date').map((x) => x.id)).toEqual([3, 4, 1, 2]);
  });
  it('falls back to vote_average when popularity is missing and never mutates input', () => {
    const noPop = items.map((x) => ({ ...x, popularity: undefined }));
    const before = noPop.map((x) => x.id);
    expect(sortTitles(noPop, 'popularity').map((x) => x.id)).toEqual([2, 3, 4, 1]);
    expect(noPop.map((x) => x.id)).toEqual(before);
  });
});

describe('sort params', () => {
  it('validates sort keys', () => {
    expect(isDiscoverSort('rating')).toBe(true);
    expect(isDiscoverSort('nope')).toBe(false);
    expect(isDiscoverSort(null)).toBe(false);
  });
  it('maps to TMDB sort_by values', () => {
    expect(toTmdbSortParam('popularity')).toBe('popularity.desc');
    expect(toTmdbSortParam('rating')).toBe('vote_average.desc');
    expect(toTmdbSortParam('date')).toBe('primary_release_date.desc');
    expect(toTmdbSortParam('date', 'tv')).toBe('first_air_date.desc');
  });
  it('builds the live discover proxy path', () => {
    expect(buildDiscoverPath({ genreId: 28, page: 2, sortBy: 'rating' })).toBe(
      '/discover/movie?with_genres=28&page=2&sort_by=vote_average.desc',
    );
    expect(buildDiscoverPath({ mediaType: 'tv' })).toBe('/discover/tv?page=1');
  });
});

describe('mock discover sortBy', () => {
  const svc = createMockTmdb();
  it('keeps legacy behaviour when sortBy is omitted', async () => {
    const res = await svc.discover({ genreId: 18 });
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results.every((x) => x.genre_ids.includes(18))).toBe(true);
  });
  it.each(['popularity', 'rating', 'date'] as const)('orders results by %s', async (sortBy) => {
    const res = await svc.discover({ genreId: 18, sortBy });
    expect(res.results.map((x) => x.id)).toEqual(sortTitles(res.results, sortBy).map((x) => x.id));
  });
});
