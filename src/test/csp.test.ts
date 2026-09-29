import { describe, expect, it } from 'vitest';
import netlifyToml from '../../netlify.toml?raw';

function cspHeader(toml: string): string {
  const match = toml.match(/^\s*Content-Security-Policy\s*=\s*"([^"]*)"/m);
  if (!match) throw new Error('Content-Security-Policy not found in netlify.toml');
  return match[1];
}

function directive(csp: string, name: string): string[] {
  const entry = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.split(/\s+/)[0] === name);
  if (!entry) throw new Error(`${name} directive not found in CSP`);
  return entry.split(/\s+/).slice(1);
}

describe('netlify.toml Content-Security-Policy', () => {
  const csp = cspHeader(netlifyToml);
  const connectSrc = directive(csp, 'connect-src');

  it('allows Supabase REST/auth (https) and realtime (wss) in connect-src', () => {
    expect(connectSrc).toContain('https://*.supabase.co');
    expect(connectSrc).toContain('wss://*.supabase.co');
  });

  it('keeps self, TMDB API and TMDB images in connect-src (PWA image caching relies on image.tmdb.org)', () => {
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('https://api.themoviedb.org');
    expect(connectSrc).toContain('https://image.tmdb.org');
  });

  it('leaves form-action restricted to self', () => {
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
  });
});
