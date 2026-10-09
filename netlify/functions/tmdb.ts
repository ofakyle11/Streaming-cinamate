import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

/**
 * TMDB proxy. The browser calls `/api/tmdb?path=movie/popular&page=2` and this
 * function forwards the request to https://api.themoviedb.org/3 with the
 * server-only TMDB_API_KEY. The key is read from process.env on every request,
 * is never logged, and is never echoed back to the client.
 *
 * Two rate limits apply. The `/api/*` rewrite in netlify.toml carries Netlify's
 * edge limit; this function also keeps its own per-IP counter (`RATE_LIMIT`)
 * so a caller who hits `/.netlify/functions/tmdb` directly, skipping the
 * rewrite, is limited too. The in-function counter lives per warm instance, so
 * it is a backstop, not the primary control.
 *
 * See docs/KEYS.md.
 */

export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 500;
/** Same window as the edge rule in netlify.toml (60 requests per 60 seconds per IP). */
export const RATE_LIMIT = { windowLimit: 60, windowSizeMs: 60 * 1000 } as const;
const RATE_MAX_CLIENTS = 5000;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_PATH_LENGTH = 200;
const MAX_PARAM_VALUE_LENGTH = 500;
const MAX_PARAMS = 30;
const MAX_PAGE = 500;

/**
 * Query parameters the app sends and TMDB documents for the allow-listed
 * paths. Anything else is dropped (not rejected) so a stray parameter cannot
 * bust the cache or multiply upstream calls.
 */
export const ALLOWED_PARAMS: ReadonlySet<string> = new Set([
  'page',
  'language',
  'region',
  'query',
  'year',
  'primary_release_year',
  'first_air_date_year',
  'with_genres',
  'without_genres',
  'with_original_language',
  'with_watch_providers',
  'watch_region',
  'sort_by',
  'vote_count.gte',
  'vote_average.gte',
  'with_runtime.gte',
  'with_runtime.lte',
  'primary_release_date.gte',
  'primary_release_date.lte',
  'first_air_date.gte',
  'first_air_date.lte',
  'release_date.gte',
  'release_date.lte',
  'air_date.gte',
  'air_date.lte',
  'with_release_type',
  'include_video',
  'include_image_language',
  'append_to_response',
]);

/** Sub-resources `append_to_response` may name: the same set the path allow-list permits. */
const ALLOWED_APPENDS: ReadonlySet<string> = new Set([
  'videos',
  'credits',
  'images',
  'similar',
  'recommendations',
  'release_dates',
  'content_ratings',
  'keywords',
  'watch/providers',
  'external_ids',
  'movie_credits',
  'tv_credits',
  'combined_credits',
]);

/**
 * Allowlisted TMDB v3 paths (relative, no leading slash). Anything else is 403.
 * Kept to read-only catalogue endpoints the app actually needs.
 */
export const ALLOWED_PATHS: readonly RegExp[] = [
  /^trending\/(all|movie|tv|person)\/(day|week)$/,
  /^movie\/(popular|top_rated|now_playing|upcoming)$/,
  /^tv\/(popular|top_rated|on_the_air|airing_today)$/,
  /^discover\/(movie|tv)$/,
  /^search\/(movie|tv|multi|person)$/,
  /^genre\/(movie|tv)\/list$/,
  /^(movie|tv)\/\d{1,10}$/,
  /^(movie|tv)\/\d{1,10}\/(videos|credits|images|similar|recommendations|release_dates|content_ratings|keywords|watch\/providers|external_ids)$/,
  /^person\/\d{1,10}$/,
  /^person\/\d{1,10}\/(movie_credits|tv_credits|combined_credits|images)$/,
  /^configuration$/,
];

type JsonHeaders = Record<string, string>;

interface CacheEntry {
  body: string;
  expires: number;
}

/** In-memory cache; lives as long as the warm function instance. */
const cache = new Map<string, CacheEntry>();

/** Test helper: clears the in-memory cache. */
export function clearTmdbCache(): void {
  cache.clear();
}

function readEnvKey(): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const key = proc?.env?.TMDB_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

function json(
  statusCode: number,
  payload: unknown,
  headers: JsonHeaders = {},
  rawBody?: string,
): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
    body: rawBody ?? JSON.stringify(payload),
  };
}

function error(
  statusCode: number,
  code: string,
  message: string,
  headers: JsonHeaders = {},
): HandlerResponse {
  return json(statusCode, { error: { code, message } }, headers);
}

/**
 * Normalises and validates the client-supplied path. Returns null when the
 * path is unsafe (traversal, absolute URL, odd characters) or not allowlisted.
 */
export function sanitizePath(
  raw: string | undefined | null,
): { ok: true; path: string } | { ok: false; reason: 'missing' | 'invalid' | 'forbidden' } {
  if (raw == null || raw.trim() === '') return { ok: false, reason: 'missing' };
  const value = raw.trim();
  if (value.length > MAX_PATH_LENGTH) return { ok: false, reason: 'invalid' };
  // Absolute URLs, protocol-relative URLs, schemes, traversal, backslashes,
  // encoded chars, query/fragment smuggling: all rejected outright.
  if (/[:\\%?#@]/.test(value) || value.includes('..') || value.includes('//')) {
    return { ok: false, reason: 'invalid' };
  }
  const path = value.replace(/^\/+/, '').replace(/^3\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9_/]+$/i.test(path)) return { ok: false, reason: 'invalid' };
  if (!ALLOWED_PATHS.some((re) => re.test(path))) return { ok: false, reason: 'forbidden' };
  return { ok: true, path };
}

/**
 * Builds the forwarded query: keeps only allow-listed TMDB parameters (so
 * `path`, client-supplied credentials and cache-busting junk never reach
 * TMDB), validates `page` and `append_to_response`, and sorts keys for a
 * stable cache key. Returns null when a kept value is invalid.
 */
export function buildForwardQuery(
  params: Record<string, string | undefined> | null,
): URLSearchParams | null {
  const out = new URLSearchParams();
  const entries = Object.entries(params ?? {}).filter(
    ([k, v]) => v !== undefined && ALLOWED_PARAMS.has(k),
  );
  if (Object.keys(params ?? {}).length > MAX_PARAMS) return null;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [k, v] of entries) {
    const value = v as string;
    if (value.length > MAX_PARAM_VALUE_LENGTH) return null;
    if (k === 'page') {
      if (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > MAX_PAGE) return null;
    } else if (k === 'append_to_response') {
      const parts = value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0 || parts.length > 10 || parts.some((p) => !ALLOWED_APPENDS.has(p)))
        return null;
    }
    out.append(k, value);
  }
  return out;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

/** Per-IP request counters for the warm instance (fixed window). */
const buckets = new Map<string, RateBucket>();

/** Test helper: clears the in-memory rate-limit counters. */
export function clearTmdbRateLimit(): void {
  buckets.clear();
}

/** Client IP as Netlify reports it; falls back to one shared bucket when absent. */
export function clientIp(headers: Record<string, string | undefined> | null | undefined): string {
  const h = headers ?? {};
  const direct = h['x-nf-client-connection-ip'] ?? h['X-NF-Client-Connection-IP'];
  if (direct && direct.trim()) return direct.trim();
  const forwarded = h['x-forwarded-for'] ?? h['X-Forwarded-For'];
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

/**
 * Counts a request for `ip` in the current window. Returns the seconds until
 * the window resets when the limit is exceeded, else 0.
 */
export function rateLimitHit(ip: string, now = Date.now()): number {
  let b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= RATE_MAX_CLIENTS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= RATE_MAX_CLIENTS) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
    }
    b = { count: 0, resetAt: now + RATE_LIMIT.windowSizeMs };
    buckets.set(ip, b);
  }
  b.count += 1;
  if (b.count > RATE_LIMIT.windowLimit) return Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return 0;
}

export async function handleTmdbRequest(
  event: Pick<HandlerEvent, 'httpMethod' | 'queryStringParameters'> & {
    headers?: HandlerEvent['headers'];
  },
): Promise<HandlerResponse> {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return error(405, 'method_not_allowed', 'Only GET is supported.', { Allow: 'GET, HEAD' });
  }

  const retryAfter = rateLimitHit(clientIp(event.headers));
  if (retryAfter > 0) {
    return error(429, 'rate_limited', 'Too many requests. Try again shortly.', {
      'Retry-After': String(retryAfter),
    });
  }

  const params = event.queryStringParameters ?? {};
  const checked = sanitizePath(params.path);
  if (!checked.ok) {
    if (checked.reason === 'missing')
      return error(400, 'missing_path', "Query parameter 'path' is required.");
    if (checked.reason === 'invalid')
      return error(400, 'invalid_path', 'Path is not a valid relative TMDB path.');
    return error(403, 'path_not_allowed', 'Path is not in the proxy allowlist.');
  }

  const query = buildForwardQuery(params);
  if (!query) return error(400, 'invalid_query', 'Query parameters are invalid.');

  const apiKey = readEnvKey();
  if (!apiKey) {
    return error(503, 'not_configured', 'TMDB proxy is not configured (TMDB_API_KEY missing).');
  }

  const cacheKey = `${checked.path}?${query.toString()}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) {
    const maxAge = Math.max(0, Math.floor((hit.expires - now) / 1000));
    return json(200, undefined, cacheHeaders(maxAge, 'HIT'), hit.body);
  }
  if (hit) cache.delete(cacheKey);

  // v4 read access tokens are JWTs -> Bearer header; v3 keys -> api_key param.
  const upstreamQuery = new URLSearchParams(query);
  // The site never shows adult titles; direct callers cannot opt in with our key.
  upstreamQuery.set('include_adult', 'false');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey.startsWith('eyJ')) headers.Authorization = `Bearer ${apiKey}`;
  else upstreamQuery.set('api_key', apiKey);
  const qs = upstreamQuery.toString();
  const url = `${TMDB_BASE}/${checked.path}${qs ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let res: Response;
  try {
    // No redirect following: a cross-host redirect would carry the v3 key in the query string.
    res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'error',
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return aborted
      ? error(504, 'upstream_timeout', 'TMDB did not respond in time.')
      : error(502, 'upstream_unreachable', 'Could not reach TMDB.');
  } finally {
    clearTimeout(timer);
  }

  let text: string;
  try {
    text = await res.text();
  } catch {
    return error(502, 'upstream_bad_response', 'TMDB returned an unreadable response.');
  }

  if (!res.ok) {
    // Never forward TMDB's body or status verbatim (both can reveal the key's state).
    if (res.status === 404) return error(404, 'not_found', 'TMDB has no such resource.');
    if (res.status === 429) return error(429, 'rate_limited', 'TMDB is rate limiting requests.');
    return error(502, 'upstream_error', 'TMDB request failed.');
  }

  try {
    JSON.parse(text);
  } catch {
    return error(502, 'upstream_bad_response', 'TMDB returned invalid JSON.');
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { body: text, expires: now + CACHE_TTL_MS });
  return json(200, undefined, cacheHeaders(CACHE_TTL_MS / 1000, 'MISS'), text);
}

function cacheHeaders(maxAge: number, status: 'HIT' | 'MISS'): JsonHeaders {
  return {
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=60`,
    'X-Cache': status,
  };
}

export const handler: Handler = async (event) => handleTmdbRequest(event);
