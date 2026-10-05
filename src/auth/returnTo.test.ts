import { describe, expect, it } from 'vitest';
import {
  RETURN_TO_KEY,
  RETURN_TO_TTL_MS,
  rememberReturnTo,
  resolveReturnTo,
  safeReturnTo,
  signInHref,
  takeReturnTo,
} from './returnTo';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('safeReturnTo', () => {
  it.each(['/', '/my-list', '/title/movie/42?from=home#cast', '/search?q=neon%20drift'])(
    'accepts the same-origin path %s',
    (p) => expect(safeReturnTo(p)).toBe(p),
  );

  it.each([
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    'javascript:alert(1)',
    'my-list',
    '',
    '   ',
    '/sign-in',
    '/sign-in/sent?email=a@b.co',
    '/auth/callback#access_token=x',
    '/a b',
    '/a\nb',
  ])('rejects %s', (p) => expect(safeReturnTo(p)).toBeNull());

  it('rejects null, undefined and over-long paths', () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo(`/${'a'.repeat(3000)}`)).toBeNull();
  });

  it('falls back to the home page', () => {
    expect(resolveReturnTo('https://evil.example')).toBe('/');
    expect(resolveReturnTo('/plans')).toBe('/plans');
  });
});

describe('signInHref', () => {
  it('carries a safe path and drops the rest', () => {
    expect(signInHref('/account')).toBe('/sign-in?returnTo=%2Faccount');
    expect(signInHref('/')).toBe('/sign-in');
    expect(signInHref('https://evil.example')).toBe('/sign-in');
    expect(signInHref(undefined)).toBe('/sign-in');
  });
});

describe('remembered return path', () => {
  it('round-trips once and then forgets', () => {
    const storage = memoryStorage();
    rememberReturnTo('/my-list', storage, 1000);
    expect(takeReturnTo(storage, 2000)).toBe('/my-list');
    expect(takeReturnTo(storage, 2000)).toBeNull();
  });

  it('expires', () => {
    const storage = memoryStorage();
    rememberReturnTo('/my-list', storage, 1000);
    expect(takeReturnTo(storage, 1000 + RETURN_TO_TTL_MS + 1)).toBeNull();
  });

  it('never stores an unsafe or default path', () => {
    const storage = memoryStorage();
    rememberReturnTo('https://evil.example', storage);
    expect(storage.getItem(RETURN_TO_KEY)).toBeNull();
    rememberReturnTo('/', storage);
    expect(storage.getItem(RETURN_TO_KEY)).toBeNull();
  });

  it('ignores corrupt or tampered storage', () => {
    const storage = memoryStorage();
    storage.setItem(RETURN_TO_KEY, '{not json');
    expect(takeReturnTo(storage)).toBeNull();
    storage.setItem(
      RETURN_TO_KEY,
      JSON.stringify({ path: 'https://evil.example', expiresAt: Date.now() + 1e6 }),
    );
    expect(takeReturnTo(storage)).toBeNull();
  });

  it('survives an unavailable storage', () => {
    expect(() => rememberReturnTo('/x', null)).not.toThrow();
    expect(takeReturnTo(null)).toBeNull();
  });
});
