/**
 * Single source of truth for the Content-Security-Policy.
 *
 * The Vite plugin below writes it to `<outDir>/_headers` at the end of every
 * production build (`npm run build`); Netlify applies it alongside the static
 * headers in netlify.toml. The CSP lives here rather than in netlify.toml
 * because two entries depend on the build's env: the Cloudflare Turnstile
 * origin is allowed only when the build has a site key (VITE_TURNSTILE_SITE_KEY),
 * and connect-src is pinned to the exact Supabase project host taken from
 * VITE_SUPABASE_URL (no Supabase origin at all in a mock-mode build).
 *
 * src/test/csp.test.ts asserts on buildCsp(), so keep this file dependency-free
 * and side-effect-free except for main().
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * The exact Supabase origins for connect-src from the project URL
 * (`https://<ref>.supabase.co`): REST/auth over https and realtime over wss.
 * Empty when the URL is unset or not an https origin, so a mock-mode build
 * allows no Supabase host at all and a typo cannot widen the policy.
 */
export function supabaseOrigins(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return [];
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [];
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) return [];
  return [`https://${parsed.host}`, `wss://${parsed.host}`];
}

/** Directives in the order they are emitted; values are source lists. */
export function cspDirectives({ turnstile = false, supabaseUrl = '' } = {}) {
  const t = turnstile ? [TURNSTILE_ORIGIN] : [];
  return {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://plausible.io',
      ...t,
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://image.tmdb.org',
      'https://picsum.photos',
      'https://fastly.picsum.photos',
      'https://i.ytimg.com',
    ],
    'media-src': ["'self'", 'blob:'],
    'frame-src': [
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://player.vimeo.com',
      ...t,
    ],
    'connect-src': [
      "'self'",
      'https://api.themoviedb.org',
      'https://image.tmdb.org',
      'https://plausible.io',
      ...supabaseOrigins(supabaseUrl),
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  };
}

/** The header value. */
export function buildCsp(opts = {}) {
  return Object.entries(cspDirectives(opts))
    .map(([name, sources]) => (sources.length ? `${name} ${sources.join(' ')}` : name))
    .join('; ');
}

/** True when a Turnstile site key is configured for this build. */
export function turnstileEnabled(env = process.env) {
  return Boolean(env.VITE_TURNSTILE_SITE_KEY?.trim());
}

/** Build options read from the same env Vite inlines into the bundle. */
export function cspOptions(env = process.env) {
  return { turnstile: turnstileEnabled(env), supabaseUrl: env.VITE_SUPABASE_URL ?? '' };
}

/** Contents of the Netlify `_headers` file for this build. */
export function headersFile(opts = {}) {
  return ['/*', `  Content-Security-Policy: ${buildCsp(opts)}`, ''].join('\n');
}

/**
 * Vite plugin: writes `_headers` into the build's outDir after the bundle is
 * written, using the same env files and mode Vite used for the bundle, so the
 * CSP always matches what the client code will load. Honors `--outDir`.
 */
export function securityHeadersPlugin() {
  let outDir = 'dist';
  let options = cspOptions({});
  return {
    name: 'lastframe-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      options = cspOptions(config.env);
    },
    async closeBundle() {
      await writeHeaders(outDir, options);
    },
  };
}

async function writeHeaders(outDir, options) {
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, '_headers'), headersFile(options), 'utf8');
  const supabase = supabaseOrigins(options.supabaseUrl)[0] ?? 'off';
  console.log(
    `security-headers: wrote ${outDir}/_headers (turnstile ${options.turnstile ? 'on' : 'off'}, supabase ${supabase})`,
  );
}

/** CLI fallback: `node scripts/security-headers.mjs [dir]` (reads env files like Vite). */
async function main() {
  const { loadEnv } = await import('vite');
  const mode = process.env.MODE || 'production';
  const options = cspOptions({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env });
  const dir = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 'dist';
  await writeHeaders(resolve(process.cwd(), dir), options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
