import { describe, expect, it, vi } from 'vitest';
import { createMockTmdb } from '../services/tmdb/mock';
import type { Movie, TmdbService } from '../services/types';
import { HOME_ROWS, HOME_ROW_LIMIT, titlePath, uniqueTitles } from './homeRows';

const movie = (id: number, mediaType: Movie['mediaType'] = 'movie'): Movie => ({
  id,
  mediaType,
  title: `T${id}`,
  year: 2020,
  rating: 'PG',
  match: 90,
  genres: [],
  description: '',
  poster: '',
  backdrop: '',
  runtime: 90,
});

describe('HOME_ROWS', () => {
  it('defines the required rows plus three genre rows', () => {
    expect(HOME_ROWS.map((r) => r.title)).toEqual([
      'Trending Now',
      'Popular Movies',
      'Popular TV',
      'Top Rated',
      'New & Upcoming',
      'Action Hits',
      'Comedy Picks',
      'Sci-Fi & Beyond',
    ]);
    expect(HOME_ROWS.filter((r) => r.id.startsWith('genre-'))).toHaveLength(3);
    expect(new Set(HOME_ROWS.map((r) => r.id)).size).toBe(HOME_ROWS.length);
  });

  it('calls the matching tmdb service methods', async () => {
    const base = createMockTmdb();
    const svc: TmdbService = {
      ...base,
      trending: vi.fn(base.trending),
      popular: vi.fn(base.popular),
      topRated: vi.fn(base.topRated),
      nowPlaying: vi.fn(base.nowPlaying),
      discover: vi.fn(base.discover),
    };
    await Promise.all(HOME_ROWS.map((r) => r.load(svc)));
    expect(svc.trending).toHaveBeenCalledTimes(1);
    expect(svc.popular).toHaveBeenCalledWith('movie');
    expect(svc.popular).toHaveBeenCalledWith('tv');
    expect(svc.topRated).toHaveBeenCalledWith('movie');
    expect(svc.nowPlaying).toHaveBeenCalledTimes(1);
    expect(svc.discover).toHaveBeenCalledWith({ genreId: 28 });
    expect(svc.discover).toHaveBeenCalledWith({ genreId: 35 });
    expect(svc.discover).toHaveBeenCalledWith({ genreId: 878 });
  });

  it('every row has mock data with no env vars', async () => {
    const svc = createMockTmdb();
    const pages = await Promise.all(HOME_ROWS.map((row) => row.load(svc)));
    pages.forEach((page, i) => expect(page.results.length, HOME_ROWS[i].title).toBeGreaterThan(0));
  });
});

describe('titlePath', () => {
  it('builds /title/:type/:id', () => {
    expect(titlePath({ mediaType: 'movie', id: 12 })).toBe('/title/movie/12');
    expect(titlePath({ mediaType: 'tv', id: 7 })).toBe('/title/tv/7');
  });
});

describe('uniqueTitles', () => {
  it('drops repeats by media type + id and caps the row', () => {
    const out = uniqueTitles([movie(1), movie(1), movie(1, 'tv'), movie(2)]);
    expect(out.map((m) => `${m.mediaType}${m.id}`)).toEqual(['movie1', 'tv1', 'movie2']);
    const many = Array.from({ length: 40 }, (_, i) => movie(i));
    expect(uniqueTitles(many)).toHaveLength(HOME_ROW_LIMIT);
    expect(uniqueTitles(many, 3)).toHaveLength(3);
  });
});
