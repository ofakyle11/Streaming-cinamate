/**
 * Single source of truth for the Content-Security-Policy.
 *
 * `npm run build` runs this after `vite build` to write `dist/_headers`, which
 * Netlify applies alongside the static headers in netlify.toml. The CSP lives
 * here rather than in netlify.toml because one entry is conditional: the
 * Cloudflare Turnstile origin is allowed only when the build has a site key
 * (VITE_TURNSTILE_SITE_KEY), so a mock-mode build ships no third-party
 * challenge origin at all.
 *
 * src/test/csp.test.ts asserts on buildCsp(), so keep this file dependency-free
 * and side-effect-free except for main().
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Directives in the order they are emitted; values are source lists. */
export function cspDirectives({ turnstile = false } = {}) {
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
      'https://*.supabase.co',
      'wss://*.supabase.co',
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

/** Contents of the Netlify `_headers` file for this build. */
export function headersFile(opts = {}) {
  return ['/*', `  Content-Security-Policy: ${buildCsp(opts)}`, ''].join('\n');
}

async function main() {
  const turnstile = turnstileEnabled();
  const outDir = resolve(process.cwd(), process.argv[2] ?? 'dist');
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, '_headers'), headersFile({ turnstile }), 'utf8');
  console.log(`security-headers: wrote ${outDir}/_headers (turnstile ${turnstile ? 'on' : 'off'})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
