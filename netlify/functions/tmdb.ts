import type { Handler, HandlerEvent } from "@netlify/functions";

/**
 * TMDB proxy. The API key lives only in process.env.TMDB_API_KEY (server side)
 * and is never returned to the client.
 * Usage: /.netlify/functions/tmdb?path=/movie/popular&page=1
 */
const TMDB_BASE = "https://api.themoviedb.org/3";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

const ALLOWED_PATHS: RegExp[] = [
  /^\/trending\/(all|movie|tv|person)\/(day|week)$/,
  /^\/(movie|tv)\/(popular|top_rated|now_playing|upcoming|airing_today|on_the_air)$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/(movie|tv)\/\d+\/(credits|videos|images|recommendations|similar|watch\/providers|release_dates|content_ratings|external_ids|keywords|reviews)$/,
  /^\/tv\/\d+\/season\/\d+$/,
  /^\/person\/\d+(\/(combined_credits|movie_credits|tv_credits))?$/,
  /^\/search\/(multi|movie|tv|person)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/configuration$/,
  /^\/watch\/providers\/(movie|tv)$/,
];

interface CacheEntry {
  expires: number;
  status: number;
  body: string;
}

const cache = new Map<string, CacheEntry>();

const respond = (
  statusCode: number,
  body: string,
  cacheControl: string,
  extra: Record<string, string> = {},
) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cacheControl,
    ...extra,
  },
  body,
});

const error = (statusCode: number, code: string, message: string) =>
  respond(statusCode, JSON.stringify({ error: { code, message } }), "no-store");

export const isAllowedPath = (path: string): boolean =>
  ALLOWED_PATHS.some((re) => re.test(path));

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET") {
    return error(405, "method_not_allowed", "Only GET is supported");
  }

  const params: Record<string, string | undefined> = {
    ...(event.queryStringParameters ?? {}),
  };
  const rawPath = params.path;
  delete params.path;
  delete params.api_key;
  if (!rawPath) {
    return error(400, "missing_path", "Query parameter 'path' is required");
  }
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  if (!isAllowedPath(path)) {
    return error(403, "path_not_allowed", "Requested path is not allowed");
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return error(503, "not_configured", "TMDB proxy is not configured");
  }

  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value !== undefined) search.set(key, value);
  }
  const cacheKey = `${path}?${search.toString()}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) {
    const age = Math.max(0, Math.floor((hit.expires - now) / 1000));
    return respond(hit.status, hit.body, `public, max-age=${age}`, {
      "X-Cache": "HIT",
    });
  }
  if (hit) cache.delete(cacheKey);

  search.set("api_key", apiKey);
  try {
    const res = await fetch(`${TMDB_BASE}${path}?${search.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const body = await res.text();
    if (!res.ok) {
      return error(
        res.status === 404 ? 404 : 502,
        "upstream_error",
        `TMDB responded with ${res.status}`,
      );
    }
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cacheKey, { expires: now + CACHE_TTL_MS, status: res.status, body });
    return respond(res.status, body, `public, max-age=${CACHE_TTL_MS / 1000}`, {
      "X-Cache": "MISS",
    });
  } catch {
    return error(502, "upstream_unreachable", "Could not reach TMDB");
  }
};
