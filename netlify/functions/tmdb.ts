import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

/**
 * TMDB proxy. The browser calls `/api/tmdb?path=movie/popular&page=2` and this
 * function forwards the request to https://api.themoviedb.org/3 with the
 * server-only TMDB_API_KEY. The key is read from process.env on every request,
 * is never logged, and is never echoed back to the client.
 *
 * See docs/KEYS.md.
 */

export const TMDB_BASE = "https://api.themoviedb.org/3";
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 500;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_PATH_LENGTH = 200;
const MAX_PARAM_VALUE_LENGTH = 500;
const MAX_PARAMS = 30;

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

function json(statusCode: number, payload: unknown, headers: JsonHeaders = {}, rawBody?: string): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
    body: rawBody ?? JSON.stringify(payload),
  };
}

function error(statusCode: number, code: string, message: string, headers: JsonHeaders = {}): HandlerResponse {
  return json(statusCode, { error: { code, message } }, headers);
}

/**
 * Normalises and validates the client-supplied path. Returns null when the
 * path is unsafe (traversal, absolute URL, odd characters) or not allowlisted.
 */
export function sanitizePath(raw: string | undefined | null): { ok: true; path: string } | { ok: false; reason: "missing" | "invalid" | "forbidden" } {
  if (raw == null || raw.trim() === "") return { ok: false, reason: "missing" };
  const value = raw.trim();
  if (value.length > MAX_PATH_LENGTH) return { ok: false, reason: "invalid" };
  // Absolute URLs, protocol-relative URLs, schemes, traversal, backslashes,
  // encoded chars, query/fragment smuggling: all rejected outright.
  if (/[:\\%?#@]/.test(value) || value.includes("..") || value.includes("//")) {
    return { ok: false, reason: "invalid" };
  }
  const path = value.replace(/^\/+/, "").replace(/^3\//, "").replace(/\/+$/, "");
  if (!/^[a-z0-9_/]+$/i.test(path)) return { ok: false, reason: "invalid" };
  if (!ALLOWED_PATHS.some((re) => re.test(path))) return { ok: false, reason: "forbidden" };
  return { ok: true, path };
}

/**
 * Builds the forwarded query: drops `path` and any client-supplied credential
 * params (api_key, in any case), sorts keys for a stable cache key.
 */
export function buildForwardQuery(params: Record<string, string | undefined> | null): URLSearchParams | null {
  const out = new URLSearchParams();
  const entries = Object.entries(params ?? {})
    .filter(([k, v]) => {
      const lower = k.toLowerCase();
      return v !== undefined && lower !== "path" && lower !== "api_key" && lower !== "access_token";
    })
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entries.length > MAX_PARAMS) return null;
  for (const [k, v] of entries) {
    if (!/^[a-z0-9_.]{1,64}$/i.test(k) || (v as string).length > MAX_PARAM_VALUE_LENGTH) return null;
    out.append(k, v as string);
  }
  return out;
}

export async function handleTmdbRequest(event: Pick<HandlerEvent, "httpMethod" | "queryStringParameters">): Promise<HandlerResponse> {
  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD") {
    return error(405, "method_not_allowed", "Only GET is supported.", { Allow: "GET, HEAD" });
  }

  const params = event.queryStringParameters ?? {};
  const checked = sanitizePath(params.path);
  if (!checked.ok) {
    if (checked.reason === "missing") return error(400, "missing_path", "Query parameter 'path' is required.");
    if (checked.reason === "invalid") return error(400, "invalid_path", "Path is not a valid relative TMDB path.");
    return error(403, "path_not_allowed", "Path is not in the proxy allowlist.");
  }

  const query = buildForwardQuery(params);
  if (!query) return error(400, "invalid_query", "Query parameters are invalid.");

  const apiKey = readEnvKey();
  if (!apiKey) {
    return error(503, "not_configured", "TMDB proxy is not configured (TMDB_API_KEY missing).");
  }

  const cacheKey = `${checked.path}?${query.toString()}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) {
    const maxAge = Math.max(0, Math.floor((hit.expires - now) / 1000));
    return json(200, undefined, cacheHeaders(maxAge, "HIT"), hit.body);
  }
  if (hit) cache.delete(cacheKey);

  // v4 read access tokens are JWTs -> Bearer header; v3 keys -> api_key param.
  const upstreamQuery = new URLSearchParams(query);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey.startsWith("eyJ")) headers.Authorization = `Bearer ${apiKey}`;
  else upstreamQuery.set("api_key", apiKey);
  const qs = upstreamQuery.toString();
  const url = `${TMDB_BASE}/${checked.path}${qs ? `?${qs}` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, signal: controller.signal });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return aborted
      ? error(504, "upstream_timeout", "TMDB did not respond in time.")
      : error(502, "upstream_unreachable", "Could not reach TMDB.");
  } finally {
    clearTimeout(timer);
  }

  let text: string;
  try {
    text = await res.text();
  } catch {
    return error(502, "upstream_bad_response", "TMDB returned an unreadable response.");
  }

  if (!res.ok) {
    // Never forward TMDB's body verbatim (it can mention the key's status).
    const status = res.status === 401 ? 502 : res.status === 404 ? 404 : res.status === 429 ? 429 : 502;
    const code = res.status === 404 ? "not_found" : res.status === 429 ? "rate_limited" : "upstream_error";
    return error(status, code, `TMDB request failed (${res.status}).`);
  }

  try {
    JSON.parse(text);
  } catch {
    return error(502, "upstream_bad_response", "TMDB returned invalid JSON.");
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { body: text, expires: now + CACHE_TTL_MS });
  return json(200, undefined, cacheHeaders(CACHE_TTL_MS / 1000, "MISS"), text);
}

function cacheHeaders(maxAge: number, status: "HIT" | "MISS"): JsonHeaders {
  return {
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=60`,
    "X-Cache": status,
  };
}

export const handler: Handler = async (event) => handleTmdbRequest(event);
