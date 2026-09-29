import { describe, expect, it } from 'vitest';
import { MOCK_TITLES, createMockTmdb } from '../../services/tmdb/mock';
import type { TmdbTitle } from '../../services/types';
import {
  EMPTY_FILTERS,
  applyFilters,
  hasActiveFilters,
  matchesFilters,
  parseFilters,
  searchKey,
  writeFilters,
} from './filters';
import { fetchSearchPage } from './useInfiniteSearch';

const title = (over: Partial<TmdbTitle> = {}): TmdbTitle => ({
  id: 1,
  media_type: 'movie',
  title: 'X',
  overview: '',
  poster_path: '/p',
  backdrop_path: '/b',
  genre_ids: [28],
  vote_average: 7.4,
  release_date: '2019-05-01',
  runtime: 100,
  ...over,
});

describe('parseFilters', () => {
  it('returns empty filters for no params', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('parses valid params', () => {
    const f = parseFilters(new URLSearchParams('q=neon&type=tv&genre=878&from=2016&to=2020&rating=7'));
    expect(f).toEqual({ type: 'tv', genreId: 878, yearFrom: 2016, yearTo: 2020, minRating: 7 });
  });

  it('drops invalid values and swaps an inverted year range', () => {
    const f = parseFilters(new URLSearchParams('type=anime&genre=abc&from=2022&to=2018&rating=42'));
    expect(f).toEqual({ type: null, genreId: null, yearFrom: 2018, yearTo: 2022, minRating: null });
  });

  it('rejects out-of-range years', () => {
    const f = parseFilters(new URLSearchParams('from=12&to=99999'));
    expect(f.yearFrom).toBeNull();
    expect(f.yearTo).toBeNull();
  });
});

describe('writeFilters', () => {
  it('round-trips and preserves unrelated params', () => {
    const f = { type: 'movie' as const, genreId: 18, yearFrom: 2015, yearTo: null, minRating: 8 };
    const out = writeFilters(new URLSearchParams('q=glass&to=2000'), f);
    expect(out.get('q')).toBe('glass');
    expect(out.has('to')).toBe(false);
    expect(parseFilters(out)).toEqual(f);
  });
});

describe('matchesFilters / applyFilters', () => {
  it('passes everything with empty filters', () => {
    expect(applyFilters(MOCK_TITLES, EMPTY_FILTERS)).toHaveLength(MOCK_TITLES.length);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('filters by type, genre, rating and inclusive year range', () => {
    const t = title();
    expect(matchesFilters(t, { ...EMPTY_FILTERS, type: 'tv' })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, genreId: 18 })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, minRating: 7.5 })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, minRating: 7 })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, yearFrom: 2019, yearTo: 2019 })).toBe(true);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, yearFrom: 2020 })).toBe(false);
    expect(matchesFilters(t, { ...EMPTY_FILTERS, yearTo: 2018 })).toBe(false);
    expect(matchesFilters(title({ release_date: '' }), { ...EMPTY_FILTERS, yearFrom: 2000 })).toBe(false);
  });

  it('applies every filter to the mock catalogue', () => {
    const f = { type: 'movie' as const, genreId: 878, yearFrom: 2016, yearTo: 2024, minRating: 7 };
    const out = applyFilters(MOCK_TITLES, f);
    expect(out.length).toBeGreaterThan(0);
    for (const t of out) {
      expect(t.media_type).toBe('movie');
      expect(t.genre_ids).toContain(878);
      expect(t.vote_average).toBeGreaterThanOrEqual(7);
      const y = Number(t.release_date.slice(0, 4));
      expect(y).toBeGreaterThanOrEqual(2016);
      expect(y).toBeLessThanOrEqual(2024);
    }
  });

  it('searchKey is stable for equivalent queries and differs on filter change', () => {
    expect(searchKey(' Neon ', EMPTY_FILTERS)).toBe(searchKey('neon', EMPTY_FILTERS));
    expect(searchKey('neon', EMPTY_FILTERS)).not.toBe(searchKey('neon', { ...EMPTY_FILTERS, type: 'tv' }));
  });
});

describe('fetchSearchPage (mock adapter)', () => {
  const svc = createMockTmdb();

  it('uses search for a query and filters client-side', async () => {
    const all = await fetchSearchPage(svc, 'the', EMPTY_FILTERS, 1);
    expect(all.results.length).toBeGreaterThan(1);
    const tv = await fetchSearchPage(svc, 'the', { ...EMPTY_FILTERS, type: 'tv' }, 1);
    expect(tv.results.length).toBeGreaterThan(0);
    expect(tv.results.length).toBeLessThan(all.results.length);
    expect(tv.results.every((t) => t.media_type === 'tv')).toBe(true);
  });

  it('uses discover for an empty query and paginates', async () => {
    const p1 = await fetchSearchPage(svc, '  ', EMPTY_FILTERS, 1);
    // No type: movie + TV discover pages are merged (20 + 20), total_pages = max of the two.
    expect(p1.results).toHaveLength(40);
    expect(p1.totalPages).toBe(2);
    const p2 = await fetchSearchPage(svc, '', EMPTY_FILTERS, 2);
    expect(p2.results).toHaveLength(20);
    expect(p2.results.every((t) => t.media_type === 'movie')).toBe(true);
    const genre = await fetchSearchPage(svc, '', { ...EMPTY_FILTERS, genreId: 99 }, 1);
    expect(genre.results.every((t) => t.genre_ids.includes(99))).toBe(true);
  });
});
