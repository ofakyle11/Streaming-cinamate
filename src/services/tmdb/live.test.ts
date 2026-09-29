import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildProxyUrl,
  createLiveTmdb,
  DEFAULT_TMDB_PROXY,
  DETAILS_APPEND,
  TmdbHttpError,
  tmdbImageUrl,
  tmdbSrcSet,
} from './live';
import { createMockTmdb } from './mock';

type Handler = (url: URL) => { status?: number; body: unknown };

function mockFetch(handler: Handler) {
  const calls: URL[] = [];
  const fn = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost');
    calls.push(url);
    const { status = 200, body } = handler(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return { fn, calls };
}

const emptyPage = { page: 1, results: [], total_pages: 1, total_results: 0 };

const movieRaw = {
  id: 1,
  media_type: 'movie',
  title: 'Film',
  overview: 'o',
  poster_path: '/p.jpg',
  backdrop_path: null,
  genre_ids: [28],
  vote_average: 7.1,
  release_date: '2024-01-02',
};
const tvRaw = {
  id: 2,
  media_type: 'tv',
  name: 'Show',
  overview: 's',
  poster_path: null,
  backdrop_path: '/b.jpg',
  genre_ids: [18],
  vote_average: 8,
  first_air_date: '2023-05-06',
};
const personRaw = { id: 3, media_type: 'person', name: 'Someone', profile_path: '/x.jpg' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildProxyUrl', () => {
  it('puts the TMDB path in ?path= and drops empty params', () => {
    const url = buildProxyUrl('/.netlify/functions/tmdb', '/movie/popular', {
      page: 2,
      a: undefined,
      b: null,
      c: '',
    });
    expect(url.startsWith('/.netlify/functions/tmdb?')).toBe(true);
    const params = new URL(url, 'http://x').searchParams;
    expect(params.get('path')).toBe('/movie/popular');
    expect(params.get('page')).toBe('2');
    expect([...params.keys()]).toEqual(['path', 'page']);
  });

  it('appends with & when the base already has a query string and adds a leading slash', () => {
    const url = buildProxyUrl('https://p.example/fn?v=1', 'genre/tv/list');
    expect(url).toBe('https://p.example/fn?v=1&path=%2Fgenre%2Ftv%2Flist');
  });
});

describe('image helpers', () => {
  it('builds sized TMDB urls and handles missing paths', () => {
    expect(tmdbImageUrl('/a.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/a.jpg');
    expect(tmdbImageUrl('/a.jpg')).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
    expect(tmdbImageUrl('a.jpg', 'original')).toBe('https://image.tmdb.org/t/p/original/a.jpg');
    expect(tmdbImageUrl('')).toBe('');
    expect(tmdbImageUrl(null)).toBe('');
    expect(tmdbImageUrl('https://cdn.example/x.jpg')).toBe('https://cdn.example/x.jpg');
  });

  it('builds a width-based srcset', () => {
    expect(tmdbSrcSet('/a.jpg', ['w342', 'w500', 'original', 'h632'])).toBe(
      'https://image.tmdb.org/t/p/w342/a.jpg 342w, https://image.tmdb.org/t/p/w500/a.jpg 500w',
    );
    expect(tmdbSrcSet('', ['w342'])).toBe('');
  });

  it('adapter imageUrl uses the TMDB CDN', () => {
    const tmdb = createLiveTmdb('/p', { fetch: mockFetch(() => ({ body: {} })).fn });
    expect(tmdb.imageUrl('/z.jpg', 'w1280')).toBe('https://image.tmdb.org/t/p/w1280/z.jpg');
  });
});

describe('createLiveTmdb', () => {
  it('defaults to the Netlify function base and uses global fetch', async () => {
    const { fn, calls } = mockFetch(() => ({ body: emptyPage }));
    vi.stubGlobal('fetch', fn);
    await createLiveTmdb().trending();
    expect(calls[0].pathname).toBe(DEFAULT_TMDB_PROXY);
    expect(calls[0].searchParams.get('path')).toBe('/trending/all/day');
    expect(calls[0].searchParams.get('page')).toBe('1');
  });

  it('strips a trailing slash from the base', async () => {
    const { fn, calls } = mockFetch(() => ({ body: emptyPage }));
    await createLiveTmdb('/api/tmdb/', { fetch: fn }).popular('tv', 3);
    expect(calls[0].pathname).toBe('/api/tmdb');
    expect(calls[0].searchParams.get('path')).toBe('/tv/popular');
    expect(calls[0].searchParams.get('page')).toBe('3');
  });

  it('normalises trending results: TV name/first_air_date, null paths, people dropped', async () => {
    const { fn } = mockFetch(() => ({
      body: { page: 1, results: [movieRaw, tvRaw, personRaw], total_pages: 5, total_results: 100 },
    }));
    const page = await createLiveTmdb('/p', { fetch: fn }).trending();
    expect(page.total_pages).toBe(5);
    expect(page.total_results).toBe(100);
    expect(page.results).toHaveLength(2);
    expect(page.results[0]).toMatchObject({
      id: 1,
      media_type: 'movie',
      title: 'Film',
      backdrop_path: '',
      release_date: '2024-01-02',
      runtime: 0,
    });
    expect(page.results[1]).toMatchObject({
      id: 2,
      media_type: 'tv',
      name: 'Show',
      poster_path: '',
      release_date: '2023-05-06',
    });
  });

  it('supports trending media type / window options', async () => {
    const { fn, calls } = mockFetch(() => ({ body: emptyPage }));
    await createLiveTmdb('/p', { fetch: fn }).trending(2, { mediaType: 'tv', window: 'week' });
    expect(calls[0].searchParams.get('path')).toBe('/trending/tv/week');
    expect(calls[0].searchParams.get('page')).toBe('2');
  });

  it('fills media_type from the endpoint when TMDB omits it', async () => {
    const { fn, calls } = mockFetch(() => ({
      body: { ...emptyPage, results: [{ ...tvRaw, media_type: undefined }] },
    }));
    const tmdb = createLiveTmdb('/p', { fetch: fn });
    const page = await tmdb.topRated('tv');
    expect(calls[0].searchParams.get('path')).toBe('/tv/top_rated');
    expect(page.results[0].media_type).toBe('tv');
    expect(page.results[0].name).toBe('Show');
  });

  it('hits the movie list endpoints', async () => {
    const { fn, calls } = mockFetch(() => ({ body: emptyPage }));
    const tmdb = createLiveTmdb('/p', { fetch: fn });
    await tmdb.nowPlaying();
    await tmdb.upcoming(4);
    expect(calls.map((c) => c.searchParams.get('path'))).toEqual([
      '/movie/now_playing',
      '/movie/upcoming',
    ]);
    expect(calls[1].searchParams.get('page')).toBe('4');
  });

  it('byGenre / discover call /discover with with_genres', async () => {
    const { fn, calls } = mockFetch(() => ({
      body: { ...emptyPage, results: [{ ...movieRaw, media_type: undefined }] },
    }));
    const tmdb = createLiveTmdb('/p', { fetch: fn });
    const page = await tmdb.byGenre(878, { mediaType: 'tv', page: 2 });
    expect(calls[0].searchParams.get('path')).toBe('/discover/tv');
    expect(calls[0].searchParams.get('with_genres')).toBe('878');
    expect(calls[0].searchParams.get('page')).toBe('2');
    expect(calls[0].searchParams.get('sort_by')).toBe('popularity.desc');
    expect(page.results[0].media_type).toBe('tv');

    await tmdb.discover({ genreId: 12 });
    expect(calls[1].searchParams.get('path')).toBe('/discover/movie');
    expect(calls[1].searchParams.get('with_genres')).toBe('12');
  });

  describe('search', () => {
    it('uses multi search, drops people, and skips the network for blank queries', async () => {
      const { fn, calls } = mockFetch(() => ({
        body: { ...emptyPage, results: [movieRaw, personRaw, tvRaw] },
      }));
      const tmdb = createLiveTmdb('/p', { fetch: fn });
      expect((await tmdb.search('   ')).results).toEqual([]);
      expect(fn).not.toHaveBeenCalled();

      const page = await tmdb.search(' neon ', 2);
      expect(calls[0].searchParams.get('path')).toBe('/search/multi');
      expect(calls[0].searchParams.get('query')).toBe('neon');
      expect(calls[0].searchParams.get('page')).toBe('2');
      expect(calls[0].searchParams.get('include_adult')).toBe('false');
      expect(page.results.map((t) => t.id)).toEqual([1, 2]);
    });

    it('passes year to typed endpoints', async () => {
      const { fn, calls } = mockFetch(() => ({ body: emptyPage }));
      const tmdb = createLiveTmdb('/p', { fetch: fn });
      await tmdb.search('x', 1, { mediaType: 'movie', year: 2020 });
      await tmdb.search('x', 1, { mediaType: 'tv', year: 2021 });
      expect(calls[0].searchParams.get('path')).toBe('/search/movie');
      expect(calls[0].searchParams.get('year')).toBe('2020');
      expect(calls[1].searchParams.get('path')).toBe('/search/tv');
      expect(calls[1].searchParams.get('first_air_date_year')).toBe('2021');
    });

    it('applies year / genre / rating filters to multi results', async () => {
      const { fn, calls } = mockFetch(() => ({
        body: { ...emptyPage, results: [movieRaw, tvRaw] },
      }));
      const tmdb = createLiveTmdb('/p', { fetch: fn });
      expect((await tmdb.search('x', 1, { year: 2023 })).results.map((t) => t.id)).toEqual([2]);
      expect(calls[0].searchParams.has('year')).toBe(false);
      expect((await tmdb.search('x', 1, { genreId: 28 })).results.map((t) => t.id)).toEqual([1]);
      expect((await tmdb.search('x', 1, { minRating: 7.5 })).results.map((t) => t.id)).toEqual([2]);
    });
  });

  describe('details', () => {
    const rawDetails = {
      id: 2,
      name: 'Show',
      overview: 's',
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      vote_average: 8.2,
      first_air_date: '2023-05-06',
      genres: [
        { id: 18, name: 'Drama' },
        { id: 9648, name: 'Mystery' },
      ],
      episode_run_time: [0, 48],
      tagline: 'Listen.',
      number_of_seasons: 2,
      credits: {
        cast: [{ id: 9, name: 'Actor', character: 'Hero', profile_path: null }],
        crew: [
          { id: 10, name: 'Dir', job: 'Director', department: 'Directing', profile_path: '/d.jpg' },
        ],
      },
      videos: {
        results: [
          {
            id: 'v1',
            key: 'abc',
            name: 'Trailer',
            site: 'YouTube',
            type: 'Trailer',
            official: true,
          },
          { id: 'v2', name: 'broken' },
        ],
      },
      similar: { results: [{ ...tvRaw, id: 20, media_type: undefined }] },
      recommendations: { results: [{ ...movieRaw, id: 21 }] },
      'watch/providers': {
        results: {
          CA: {
            link: 'https://x',
            flatrate: [
              { provider_id: 8, provider_name: 'P', logo_path: '/l.png', display_priority: 1 },
            ],
          },
        },
      },
    };

    it('requests append_to_response and normalises the payload', async () => {
      const { fn, calls } = mockFetch(() => ({ body: rawDetails }));
      const d = await createLiveTmdb('/p', { fetch: fn }).details('tv', 2);
      expect(calls[0].searchParams.get('path')).toBe('/tv/2');
      expect(calls[0].searchParams.get('append_to_response')).toBe(DETAILS_APPEND);
      expect(DETAILS_APPEND).toBe('credits,videos,similar,recommendations,watch/providers');
      expect(d).not.toBeNull();
      expect(d).toMatchObject({
        id: 2,
        media_type: 'tv',
        name: 'Show',
        release_date: '2023-05-06',
        genre_ids: [18, 9648],
        runtime: 48,
        tagline: 'Listen.',
        number_of_seasons: 2,
      });
      expect(d!.credits!.cast[0]).toEqual({
        id: 9,
        name: 'Actor',
        character: 'Hero',
        profile_path: '',
        order: 0,
      });
      expect(d!.credits!.crew[0].job).toBe('Director');
      expect(d!.videos).toEqual([
        { id: 'v1', key: 'abc', name: 'Trailer', site: 'YouTube', type: 'Trailer', official: true },
      ]);
      expect(d!.similar![0]).toMatchObject({ id: 20, media_type: 'tv' });
      expect(d!.recommendations![0]).toMatchObject({ id: 21, media_type: 'movie' });
      expect(d!.watchProviders!.CA.flatrate![0].provider_name).toBe('P');
    });

    it('uses movie runtime', async () => {
      const { fn } = mockFetch(() => ({
        body: {
          ...movieRaw,
          runtime: 131,
          genre_ids: undefined,
          genres: [{ id: 28, name: 'Action' }],
        },
      }));
      const d = await createLiveTmdb('/p', { fetch: fn }).details('movie', 1);
      expect(d).toMatchObject({
        media_type: 'movie',
        title: 'Film',
        runtime: 131,
        genre_ids: [28],
      });
    });

    it('returns null on 404 and throws on other errors', async () => {
      const notFound = createLiveTmdb('/p', {
        fetch: mockFetch(() => ({ status: 404, body: {} })).fn,
      });
      expect(await notFound.details('movie', 404)).toBeNull();
      const broken = createLiveTmdb('/p', {
        fetch: mockFetch(() => ({ status: 502, body: {} })).fn,
      });
      await expect(broken.details('movie', 1)).rejects.toBeInstanceOf(TmdbHttpError);
      await expect(broken.popular('movie')).rejects.toMatchObject({
        status: 502,
        path: '/movie/popular',
      });
    });
  });

  describe('genres', () => {
    it('merges movie + tv lists, dedupes, sorts and caches', async () => {
      const { fn, calls } = mockFetch((url) => ({
        body:
          url.searchParams.get('path') === '/genre/movie/list'
            ? {
                genres: [
                  { id: 28, name: 'Action' },
                  { id: 18, name: 'Drama' },
                ],
              }
            : {
                genres: [
                  { id: 18, name: 'Drama' },
                  { id: 10765, name: 'Sci-Fi & Fantasy' },
                ],
              },
      }));
      const tmdb = createLiveTmdb('/p', { fetch: fn });
      expect(await tmdb.genres()).toEqual([
        { id: 28, name: 'Action' },
        { id: 18, name: 'Drama' },
        { id: 10765, name: 'Sci-Fi & Fantasy' },
      ]);
      expect((await tmdb.genres('tv')).map((g) => g.id)).toEqual([18, 10765]);
      await tmdb.genres();
      expect(calls).toHaveLength(2);
    });

    it('does not cache failures', async () => {
      let fail = true;
      const { fn } = mockFetch(() =>
        fail ? { status: 500, body: {} } : { body: { genres: [{ id: 1, name: 'A' }] } },
      );
      const tmdb = createLiveTmdb('/p', { fetch: fn });
      await expect(tmdb.genres('movie')).rejects.toBeInstanceOf(TmdbHttpError);
      fail = false;
      expect(await tmdb.genres('movie')).toEqual([{ id: 1, name: 'A' }]);
    });
  });
});

describe('mock adapter parity', () => {
  const mock = createMockTmdb();

  it('implements upcoming and byGenre', async () => {
    const up = await mock.upcoming();
    expect(up.results.length).toBeGreaterThan(0);
    expect(up.results.every((t) => t.media_type === 'movie')).toBe(true);
    const sf = await mock.byGenre(878, { mediaType: 'tv' });
    expect(sf.results.length).toBeGreaterThan(0);
    expect(sf.results.every((t) => t.media_type === 'tv' && t.genre_ids.includes(878))).toBe(true);
  });

  it('supports trending options and search filters', async () => {
    const tv = await mock.trending(1, { mediaType: 'tv' });
    expect(tv.results.every((t) => t.media_type === 'tv')).toBe(true);
    const all = await mock.search('the');
    const movies = await mock.search('the', 1, { mediaType: 'movie' });
    expect(movies.results.length).toBeGreaterThan(0);
    expect(movies.results.length).toBeLessThan(all.results.length);
    expect(movies.results.every((t) => t.media_type === 'movie')).toBe(true);
  });

  it('returns rich details', async () => {
    const d = await mock.details('movie', 1000);
    expect(d?.credits?.cast.length).toBeGreaterThan(0);
    expect(d?.similar?.length).toBeGreaterThan(0);
    expect(d?.genres?.length).toBeGreaterThan(0);
    expect(await mock.details('tv', 1000)).toBeNull();
  });
});
