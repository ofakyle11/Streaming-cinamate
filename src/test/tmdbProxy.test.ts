import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_PARAMS,
  CACHE_TTL_MS,
  RATE_LIMIT,
  buildForwardQuery,
  clearTmdbCache,
  clearTmdbRateLimit,
  clientIp,
  handleTmdbRequest,
  rateLimitHit,
  sanitizePath,
} from '../../netlify/functions/tmdb';

const KEY = 'secret-v3-key-123';

let requestNo = 0;

/** Each test request comes from its own IP so the per-IP limit never trips by accident. */
function get(params: Record<string, string | undefined> | null, ip = `10.0.0.${++requestNo}`) {
  return handleTmdbRequest({
    httpMethod: 'GET',
    queryStringParameters: params,
    headers: { 'x-nf-client-connection-ip': ip },
  });
}

function okResponse(body: unknown = { results: [{ id: 1 }] }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clearTmdbCache();
  clearTmdbRateLimit();
  fetchMock = vi.fn(async () => okResponse());
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('TMDB_API_KEY', KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function calledUrl(n = 0): URL {
  return new URL(String(fetchMock.mock.calls[n][0]));
}

describe('sanitizePath', () => {
  it.each([
    ['movie/popular', 'movie/popular'],
    ['/movie/550', 'movie/550'],
    ['movie/550/videos/', 'movie/550/videos'],
    ['trending/movie/week', 'trending/movie/week'],
    ['movie/550/watch/providers', 'movie/550/watch/providers'],
  ])('accepts %s', (raw, expected) => {
    expect(sanitizePath(raw)).toEqual({ ok: true, path: expected });
  });

  it.each([
    'https://evil.example/x',
    '//evil.example/movie/popular',
    'http:/evil',
    '../movie/popular',
    'movie/../account',
    'movie/%2e%2e/account',
    'movie\\popular',
    'movie/popular?api_key=x',
    'movie/popular#x',
    'user@evil/movie/popular',
    'movie/pop ular',
  ])('rejects unsafe %s', (raw) => {
    expect(sanitizePath(raw)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each(['account', 'movie/550/rating', 'authentication/token/new', 'list/1'])(
    'rejects non-allowlisted %s',
    (raw) => {
      expect(sanitizePath(raw)).toEqual({ ok: false, reason: 'forbidden' });
    },
  );

  it('flags missing path', () => {
    expect(sanitizePath(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(sanitizePath('  ')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('buildForwardQuery', () => {
  it('drops path and client credentials, sorts keys', () => {
    const q = buildForwardQuery({
      path: 'x',
      page: '2',
      API_KEY: 'a',
      api_key: 'b',
      access_token: 'c',
      language: 'en-US',
    });
    expect(q?.toString()).toBe('language=en-US&page=2');
  });

  it('drops parameters that are not on the allow-list (no cache busting, no upstream fan-out)', () => {
    expect(buildForwardQuery({ page: '1', x: '1', 'a b': '1', cachebust: 'zzz' })?.toString()).toBe(
      'page=1',
    );
    expect(ALLOWED_PARAMS.has('api_key')).toBe(false);
    expect(ALLOWED_PARAMS.has('path')).toBe(false);
  });

  it('bounds page and validates append_to_response against the sub-resource allow-list', () => {
    expect(buildForwardQuery({ page: '500' })?.toString()).toBe('page=500');
    expect(buildForwardQuery({ page: '0' })).toBeNull();
    expect(buildForwardQuery({ page: '501' })).toBeNull();
    expect(buildForwardQuery({ page: '2abc' })).toBeNull();
    expect(
      buildForwardQuery({
        append_to_response: 'credits,videos,similar,recommendations,watch/providers',
      })?.toString(),
    ).toBe('append_to_response=credits%2Cvideos%2Csimilar%2Crecommendations%2Cwatch%2Fproviders');
    expect(buildForwardQuery({ append_to_response: 'reviews' })).toBeNull();
    expect(buildForwardQuery({ append_to_response: 'credits,account_states' })).toBeNull();
    expect(buildForwardQuery({ append_to_response: '' })).toBeNull();
  });
});

describe('rate limit backstop', () => {
  it('reads the client IP from the Netlify header, then X-Forwarded-For, else a shared bucket', () => {
    expect(clientIp({ 'x-nf-client-connection-ip': '203.0.113.9' })).toBe('203.0.113.9');
    expect(clientIp({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' })).toBe('198.51.100.4');
    expect(clientIp({})).toBe('unknown');
    expect(clientIp(undefined)).toBe('unknown');
  });

  it('allows 60 requests a minute per IP and then answers 429 with Retry-After', async () => {
    expect(RATE_LIMIT.windowLimit).toBe(60);
    for (let i = 0; i < RATE_LIMIT.windowLimit; i += 1) {
      expect(
        (await get({ path: 'movie/popular', page: String((i % 5) + 1) }, '203.0.113.1')).statusCode,
      ).toBe(200);
    }
    const blocked = await get({ path: 'movie/popular' }, '203.0.113.1');
    expect(blocked.statusCode).toBe(429);
    expect(JSON.parse(blocked.body ?? '').error.code).toBe('rate_limited');
    expect(Number(blocked.headers?.['Retry-After'])).toBeGreaterThan(0);
    expect(blocked.headers?.['Cache-Control']).toBe('no-store');
    // Another IP is unaffected.
    expect((await get({ path: 'movie/popular' }, '203.0.113.2')).statusCode).toBe(200);
  });

  it('resets the window after it elapses', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT.windowLimit; i += 1) expect(rateLimitHit('ip', t0)).toBe(0);
    expect(rateLimitHit('ip', t0 + 1000)).toBe(59);
    expect(rateLimitHit('ip', t0 + RATE_LIMIT.windowSizeMs)).toBe(0);
  });

  it('counts the bypass path too: the limit does not depend on the /api/* rewrite', async () => {
    // The handler has no notion of the path it was reached by; every call counts.
    for (let i = 0; i < RATE_LIMIT.windowLimit; i += 1)
      await get({ path: 'configuration' }, '203.0.113.3');
    expect((await get({ path: 'configuration' }, '203.0.113.3')).statusCode).toBe(429);
  });
});

describe('handleTmdbRequest', () => {
  it('forwards path and query to TMDB with the server key', async () => {
    const res = await get({ path: 'movie/popular', page: '2' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '')).toEqual({ results: [{ id: 1 }] });
    const url = calledUrl();
    expect(url.origin + url.pathname).toBe('https://api.themoviedb.org/3/movie/popular');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('api_key')).toBe(KEY);
    expect(res.headers?.['Cache-Control']).toMatch(/max-age=600/);
    expect(res.headers?.['X-Cache']).toBe('MISS');
  });

  it('never exposes the key in the response', async () => {
    const res = await get({ path: 'movie/popular' });
    expect(JSON.stringify(res)).not.toContain(KEY);
  });

  it('always asks TMDB for the non-adult catalogue, whatever the caller sends', async () => {
    await get({ path: 'search/movie', query: 'x', include_adult: 'true' });
    expect(calledUrl().searchParams.getAll('include_adult')).toEqual(['false']);
    expect(ALLOWED_PARAMS.has('include_adult')).toBe(false);
  });

  it('strips a client-supplied api_key param', async () => {
    await get({ path: 'movie/popular', api_key: 'attacker' });
    expect(calledUrl().searchParams.getAll('api_key')).toEqual([KEY]);
  });

  it('uses a Bearer header for v4 read tokens', async () => {
    vi.stubEnv('TMDB_API_KEY', 'eyJhbGciOiJIUzI1NiJ9.token');
    await get({ path: 'movie/popular' });
    expect(calledUrl().searchParams.has('api_key')).toBe(false);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer eyJhbGciOiJIUzI1NiJ9.token',
    );
  });

  it('never follows an upstream redirect (the v3 key travels in the query string)', async () => {
    await get({ path: 'movie/popular' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe('error');
  });

  it('returns 503 JSON when TMDB_API_KEY is missing', async () => {
    vi.stubEnv('TMDB_API_KEY', '');
    const res = await get({ path: 'movie/popular' });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body ?? '').error.code).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects traversal / absolute URLs with 400 and never fetches', async () => {
    for (const path of ['../secret', 'https://evil.example', '//evil.example']) {
      const res = await get({ path });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body ?? '').error.code).toBe('invalid_path');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 403 for non-allowlisted paths', async () => {
    const res = await get({ path: 'account' });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body ?? '').error.code).toBe('path_not_allowed');
  });

  it('returns 400 when path is missing', async () => {
    const res = await get(null);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? '').error.code).toBe('missing_path');
  });

  it('returns 405 for non-GET', async () => {
    const res = await handleTmdbRequest({
      httpMethod: 'POST',
      queryStringParameters: { path: 'movie/popular' },
    });
    expect(res.statusCode).toBe(405);
    expect(res.headers?.Allow).toBe('GET, HEAD');
  });

  it('caches for 10 minutes then refetches', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await get({ path: 'movie/popular', page: '1' });
    const second = await get({ page: '1', path: 'movie/popular' });
    expect(second.headers?.['X-Cache']).toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await get({ path: 'movie/popular', page: '2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(Date.now() + CACHE_TTL_MS + 1);
    const third = await get({ path: 'movie/popular', page: '1' });
    expect(third.headers?.['X-Cache']).toBe('MISS');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not cache upstream errors and maps them to error JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status_message: `bad key ${KEY}` }), { status: 401 }),
    );
    const res = await get({ path: 'movie/popular' });
    expect(res.statusCode).toBe(502);
    expect(res.headers?.['Cache-Control']).toBe('no-store');
    expect(res.body).not.toContain(KEY);
    expect(res.body).not.toContain('401'); // the key's state is not reported to callers
    expect(JSON.parse(res.body ?? '').error.code).toBe('upstream_error');

    const again = await get({ path: 'movie/popular' });
    expect(again.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps 404 and 429 from TMDB', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect((await get({ path: 'movie/999999' })).statusCode).toBe(404);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect((await get({ path: 'movie/1' })).statusCode).toBe(429);
  });

  it('returns 502 when TMDB is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    const res = await get({ path: 'movie/popular' });
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body ?? '').error.code).toBe('upstream_unreachable');
  });
});
