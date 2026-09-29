import { describe, expect, it } from 'vitest';
import netlifyToml from '../../netlify.toml?raw';
import { DEFAULT_PLAUSIBLE_HOST } from '../services/analytics/plausible';

/** Extract the Content-Security-Policy header value from netlify.toml text. */
function readCsp(toml: string): string {
  const match = /^\s*Content-Security-Policy\s*=\s*"([^"]*)"/m.exec(toml);
  if (!match) throw new Error('Content-Security-Policy not found in netlify.toml');
  return match[1];
}

/** Parse a CSP string into directive -> source list. */
function parseCsp(csp: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out.set(name.toLowerCase(), sources);
  }
  return out;
}

describe('netlify.toml CSP', () => {
  const csp = parseCsp(readCsp(netlifyToml));
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
  });
});
