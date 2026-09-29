import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTmdbCache, handleTmdbRequest, TMDB_BASE } from '../../netlify/functions/tmdb';
import { createLiveTmdb } from '../services/tmdb/live';
import { DISCOVER_SORTS } from '../services/tmdb/sort';
import type { MediaType, TmdbService } from '../services/types';

/**
 * Contract test: every request the live TMDB adapter (src/services/tmdb/live.ts)
 * makes must be accepted by the Netlify proxy (netlify/functions/tmdb.ts):
 * allowlisted path, valid forwarded query, and a server-side key only.
 */

const PROXY = '/.netlify/functions/tmdb';
const DUMMY_KEY = 'contract-test-dummy-key';

interface ProxyCall {
  url: string;
  params: Record<string, string>;
  status: number;
  body: string;
}

const MOVIE_DETAILS = {
  id: 603,
  title: 'The Matrix',
  overview: 'A hacker learns the truth.',
  poster_path: '/matrix.jpg',
  backdrop_path: '/matrix-bg.jpg',
  vote_average: 8.2,
  release_date: '1999-03-31',
  runtime: 136,
  genres: [{ id: 28, name: 'Action' }],
  tagline: 'Welcome to the Real World.',
  credits: {
    cast: [{ id: 6384, name: 'Keanu Reeves', character: 'Neo', profile_path: '/k.jpg', order: 0 }],
    crew: [{ id: 9339, name: 'Lana Wachowski', job: 'Director', department: 'Directing' }],
  },
  videos: { results: [{ id: 'v1', key: 'abc123', name: 'Trailer', site: 'YouTube', type: 'Trailer', official: true }] },
  similar: { results: [{ id: 604, title: 'The Matrix Reloaded', genre_ids: [28] }] },
  recommendations: { results: [{ id: 605, title: 'The Matrix Revolutions', genre_ids: [28] }] },
  'watch/providers': { results: { US: { link: 'https://example.test/watch' } } },
};

const TV_DETAILS = {
  id: 1396,
  name: 'Breaking Bad',
  overview: 'A chemistry teacher turns to crime.',
  first_air_date: '2008-01-20',
  episode_run_time: [0, 47],
  genres: [{ id: 18, name: 'Drama' }],
  number_of_seasons: 5,
  number_of_episodes: 62,
  credits: { cast: [], crew: [] },
  videos: { results: [] },
  similar: { results: [] },
  recommendations: { results: [] },
  'watch/providers': { results: {} },
};

function cannedUpstream(url: URL): unknown {
  const path = url.pathname.replace(/^\/3\//, '');
  if (/^genre\/(movie|tv)\/list$/.test(path)) {
    return { genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }] };
  }
  if (/^movie\/\d+$/.test(path)) return MOVIE_DETAILS;
  if (/^tv\/\d+$/.test(path)) return TV_DETAILS;
  return {
    page: Number(url.searchParams.get('page') ?? 1),
    results: [
      { id: 1, title: 'Alpha', media_type: 'movie', genre_ids: [28], vote_average: 7, release_date: '2020-01-01' },
      { id: 2, name: 'Beta', media_type: 'tv', genre_ids: [18], vote_average: 8, first_air_date: '2020-05-01' },
    ],
    total_pages: 3,
    total_results: 2,
  };
}

let proxyCalls: ProxyCall[];
let upstreamUrls: string[];

/** Client-side fetch stub: routes the adapter's request through the real proxy handler. */
async function proxyFetch(input: string): Promise<Response> {
  const url = new URL(input, 'http://localhost');
  expect(url.pathname).toBe(PROXY);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });
  const res = await handleTmdbRequest({ httpMethod: 'GET', queryStringParameters: params });
  const body = res.body ?? '';
  proxyCalls.push({ url: input, params, status: res.statusCode, body });
  return new Response(body, { status: res.statusCode, headers: { 'Content-Type': 'application/json' } });
}

function expectAllProxyCallsOk() {
  expect(proxyCalls.length).toBeGreaterThan(0);
  for (const call of proxyCalls) {
    expect({ url: call.url, status: call.status, body: call.status >= 400 ? call.body : '' }).toEqual({
      url: call.url,
      status: 200,
      body: '',
    });
  }
}

function expectUpstreamKeyServerSideOnly() {
  expect(upstreamUrls.length).toBeGreaterThan(0);
  for (const raw of upstreamUrls) {
    const url = new URL(raw);
    expect(raw.startsWith(`${TMDB_BASE}/`)).toBe(true);
    // Exactly one api_key, and it is the server's env key, never a client value.
    expect(url.searchParams.getAll('api_key')).toEqual([DUMMY_KEY]);
    expect(url.searchParams.has('path')).toBe(false);
    expect(url.searchParams.has('access_token')).toBe(false);
  }
}

let tmdb: TmdbService;

beforeEach(() => {
  clearTmdbCache();
  proxyCalls = [];
  upstreamUrls = [];
  vi.stubEnv('TMDB_API_KEY', DUMMY_KEY);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      upstreamUrls.push(raw);
      return new Response(JSON.stringify(cannedUpstream(new URL(raw))), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  tmdb = createLiveTmdb(PROXY, { fetch: proxyFetch });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearTmdbCache();
});

const MEDIA: MediaType[] = ['movie', 'tv'];

describe('live TMDB adapter <-> proxy contract', () => {
  it('trending: every mediaType and window is allowlisted', async () => {
    for (const mediaType of ['all', 'movie', 'tv'] as const) {
      for (const window of ['day', 'week'] as const) {
        const page = await tmdb.trending(2, { mediaType, window });
        expect(page.results.length).toBeGreaterThan(0);
      }
    }
    await tmdb.trending();
    expect(proxyCalls).toHaveLength(7);
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();
  });

  it('popular / topRated for movie and tv, nowPlaying, upcoming', async () => {
    for (const m of MEDIA) {
      await tmdb.popular(m, 1);
      await tmdb.topRated(m, 2);
    }
    await tmdb.nowPlaying(1);
    await tmdb.upcoming(3);
    expect(proxyCalls).toHaveLength(6);
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();
  });

  it('discover: every sortBy for movie and tv (dotted sort_by values), with and without genre', async () => {
    for (const m of MEDIA) {
      await tmdb.discover({ mediaType: m });
      for (const { id } of DISCOVER_SORTS) {
        await tmdb.discover({ mediaType: m, sortBy: id, page: 2 });
        await tmdb.discover({ mediaType: m, sortBy: id, genreId: 28 });
      }
    }
    await tmdb.discover({});
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();
    const sorts = new Set(upstreamUrls.map((u) => new URL(u).searchParams.get('sort_by')));
    expect(sorts).toEqual(
      new Set(['popularity.desc', 'vote_average.desc', 'primary_release_date.desc', 'first_air_date.desc']),
    );
  });

  it('byGenre for movie and tv', async () => {
    await tmdb.byGenre(28);
    await tmdb.byGenre(18, { mediaType: 'tv', page: 2 });
    expect(proxyCalls).toHaveLength(2);
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();
  });

  it('search with and without mediaType / year', async () => {
    await tmdb.search('matrix');
    await tmdb.search('matrix', 2, { year: 2020 });
    for (const m of MEDIA) {
      await tmdb.search('matrix', 1, { mediaType: m });
      await tmdb.search('matrix', 1, { mediaType: m, year: 1999 });
    }
    expect(proxyCalls).toHaveLength(6);
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();
  });

  it('details for movie and tv (append_to_response incl. watch/providers) resolve to normalized data', async () => {
    const movie = await tmdb.details('movie', 603);
    const tv = await tmdb.details('tv', 1396);
    expect(proxyCalls).toHaveLength(2);
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();

    for (const u of upstreamUrls) {
      expect(new URL(u).searchParams.get('append_to_response')).toBe(
        'credits,videos,similar,recommendations,watch/providers',
      );
    }

    expect(movie).not.toBeNull();
    expect(movie).toMatchObject({
      id: 603,
      media_type: 'movie',
      title: 'The Matrix',
      runtime: 136,
      genre_ids: [28],
      tagline: 'Welcome to the Real World.',
      credits: { cast: [{ name: 'Keanu Reeves', character: 'Neo' }] },
      videos: [{ key: 'abc123', site: 'YouTube' }],
      similar: [{ id: 604, media_type: 'movie' }],
      recommendations: [{ id: 605, media_type: 'movie' }],
      watchProviders: { US: { link: 'https://example.test/watch' } },
    });

    expect(tv).toMatchObject({
      id: 1396,
      media_type: 'tv',
      name: 'Breaking Bad',
      release_date: '2008-01-20',
      runtime: 47,
      number_of_seasons: 5,
      genre_ids: [18],
    });
  });

  it('genres() for movie, tv and merged', async () => {
    const merged = await tmdb.genres();
    expect(merged.map((g) => g.name)).toEqual(['Action', 'Drama']);
    await tmdb.genres('movie');
    await tmdb.genres('tv');
    expectAllProxyCallsOk();
    expectUpstreamKeyServerSideOnly();
  });

  it('a client-supplied api_key never reaches TMDB', async () => {
    const leaky = createLiveTmdb(`${PROXY}?api_key=client-evil&API_KEY=client-evil2`, { fetch: proxyFetch });
    await leaky.popular('movie');
    expectAllProxyCallsOk();
    expect(proxyCalls[0].params.api_key).toBe('client-evil');
    expectUpstreamKeyServerSideOnly();
    expect(upstreamUrls.join(' ')).not.toContain('client-evil');
  });
});
