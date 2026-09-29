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

  it.each(['script-src', 'connect-src'])('%s allows the default Plausible host', (directive) => {
    expect(csp.get(directive)).toContain(DEFAULT_PLAUSIBLE_HOST);
  });

  it('does not add the Plausible host to unrelated directives', () => {
    for (const directive of ['default-src', 'frame-src', 'img-src', 'object-src']) {
      expect(csp.get(directive) ?? []).not.toContain(DEFAULT_PLAUSIBLE_HOST);
    }
  });

  it('keeps the existing lockdown directives', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
  });
});
