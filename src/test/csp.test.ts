import { describe, expect, it } from 'vitest';
import netlifyToml from '../../netlify.toml?raw';
import pkg from '../../package.json';
import { DEFAULT_PLAUSIBLE_HOST } from '../services/analytics/plausible';
import { TURNSTILE_ORIGIN as CLIENT_TURNSTILE_ORIGIN } from '../services/auth/turnstile';
import {
  buildCsp,
  headersFile,
  TURNSTILE_ORIGIN,
  turnstileEnabled,
} from '../../scripts/security-headers.mjs';

/** Parse a CSP string into directive -> source list. */
function parseCsp(csp: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out.set(name.toLowerCase(), sources);
  }
  return out;
}

describe('CSP source of truth', () => {
  it('is generated into dist/_headers by the build, not hard-coded in netlify.toml', () => {
    expect(netlifyToml).not.toMatch(/^\s*Content-Security-Policy\s*=/m);
    expect(pkg.scripts.build).toMatch(/vite build && node scripts\/security-headers\.mjs$/);
  });

  it('writes a _headers file for every path', () => {
    const file = headersFile();
    expect(file.startsWith('/*\n  Content-Security-Policy: ')).toBe(true);
    expect(file).toContain(buildCsp());
  });
});

describe.each([false, true])('CSP (turnstile %s)', (turnstile) => {
  const csp = parseCsp(buildCsp({ turnstile }));
  const connectSrc = csp.get('connect-src') ?? [];

  it.each(['script-src', 'connect-src'])('%s allows the default Plausible host', (directive) => {
    expect(csp.get(directive)).toContain(DEFAULT_PLAUSIBLE_HOST);
  });

  it('does not add the Plausible host to unrelated directives', () => {
    for (const directive of ['default-src', 'frame-src', 'img-src', 'object-src']) {
      expect(csp.get(directive) ?? []).not.toContain(DEFAULT_PLAUSIBLE_HOST);
    }
  });

  it('allows Supabase REST/auth (https) and realtime (wss) in connect-src', () => {
    expect(connectSrc).toContain('https://*.supabase.co');
    expect(connectSrc).toContain('wss://*.supabase.co');
  });

  it('keeps self, TMDB API and TMDB images in connect-src (PWA image caching relies on image.tmdb.org)', () => {
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('https://api.themoviedb.org');
    expect(connectSrc).toContain('https://image.tmdb.org');
  });

  it('keeps TMDB images and YouTube allowed', () => {
    expect(csp.get('img-src')).toContain('https://image.tmdb.org');
    expect(csp.get('frame-src')).toContain('https://www.youtube-nocookie.com');
  });

  it('keeps the existing lockdown directives', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.has('upgrade-insecure-requests')).toBe(true);
  });

  it('allows Turnstile in script-src and frame-src only when a site key is set', () => {
    for (const directive of ['script-src', 'frame-src']) {
      expect((csp.get(directive) ?? []).includes(TURNSTILE_ORIGIN)).toBe(turnstile);
    }
    for (const directive of ['connect-src', 'img-src', 'default-src']) {
      expect(csp.get(directive) ?? []).not.toContain(TURNSTILE_ORIGIN);
    }
  });
});

describe('Turnstile switch', () => {
  it('uses the same origin as the client loader', () => {
    expect(TURNSTILE_ORIGIN).toBe(CLIENT_TURNSTILE_ORIGIN);
  });

  it('turns on only for a non-blank VITE_TURNSTILE_SITE_KEY', () => {
    expect(turnstileEnabled({})).toBe(false);
    expect(turnstileEnabled({ VITE_TURNSTILE_SITE_KEY: '  ' })).toBe(false);
    expect(turnstileEnabled({ VITE_TURNSTILE_SITE_KEY: '0x4AAA' })).toBe(true);
  });
});

describe('rate limit on /api/*', () => {
  it('limits the functions rewrite to 60 requests a minute per IP', () => {
    const block =
      /\[\[redirects\]\]\s*from = "\/api\/\*"[\s\S]*?(?=\[\[)/.exec(netlifyToml)?.[0] ?? '';
    expect(block).toContain('[redirects.rate_limit]');
    expect(block).toMatch(/window_limit = 60\b/);
    expect(block).toMatch(/window_size = 60\b/);
    expect(block).toMatch(/aggregate_by = \["ip", "domain"\]/);
  });
});
