import { describe, expect, it } from 'vitest';
import { authRedirectUrl, isValidEmail, normalizeEmail, requireEmail } from './validate';

describe('auth validation', () => {
  it('normalises and validates emails', () => {
    expect(normalizeEmail('  A@B.Co ')).toBe('a@b.co');
    expect(isValidEmail('a@b.co')).toBe(true);
    for (const bad of ['', 'a', 'a@b', 'a b@c.de', '@b.co', `${'x'.repeat(250)}@b.co`]) {
      expect(isValidEmail(bad)).toBe(false);
    }
    expect(() => requireEmail('x')).toThrow(/valid email/);
  });

  it('builds the redirect URL from the current origin', () => {
    expect(authRedirectUrl()).toBe(`${window.location.origin}/auth/callback`);
    expect(authRedirectUrl('/')).toBe(`${window.location.origin}/`);
  });
});
