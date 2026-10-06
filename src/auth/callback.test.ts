import { afterEach, describe, expect, it } from 'vitest';
import { captureAuthCallback, safeReturnPath } from './callback';
import { bootAuthCallback, clearAuthCallback, readAuthCallback } from './callbackBoot';

function setUrl(url: string) {
  window.history.replaceState(null, '', url);
}

afterEach(() => {
  clearAuthCallback();
  setUrl('/');
});

describe('safeReturnPath', () => {
  it.each([
    ['/account', '/account'],
    ['/title/movie/1?x=1#y', '/title/movie/1?x=1#y'],
    [' /my-list ', '/my-list'],
  ])('keeps same-origin path %s', (raw, want) => {
    expect(safeReturnPath(raw)).toBe(want);
  });

  it.each([
    null,
    undefined,
    '',
    'account',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'https://evil.example/account',
    'javascript:alert(1)',
    'data:text/html,hi',
    '/ok\nLocation: x',
    '/auth/callback',
    '/auth/callback?code=1',
  ])('rejects %s', (raw) => {
    expect(safeReturnPath(raw as string | null | undefined)).toBe('/');
  });

  it('reduces a full same-origin URL to its path', () => {
    expect(safeReturnPath(`${window.location.origin}/account?tab=security`)).toBe(
      '/account?tab=security',
    );
  });
});

describe('captureAuthCallback', () => {
  it('reads tokens from hash and query, then strips them from the URL', () => {
    setUrl(
      '/auth/callback?code=c1&returnTo=%2Fmy-list&keep=1#access_token=a&refresh_token=r&type=magiclink',
    );
    const got = captureAuthCallback();
    expect(got.params).toMatchObject({
      code: 'c1',
      access_token: 'a',
      refresh_token: 'r',
      type: 'magiclink',
    });
    expect(got.returnTo).toBe('/my-list');
    expect(got.hadParams).toBe(true);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/auth/callback?keep=1',
    );
  });

  it('drops an off-site return path', () => {
    setUrl('/auth/callback?next=https://evil.example');
    expect(captureAuthCallback().returnTo).toBe('/');
    expect(window.location.search).toBe('');
  });

  it('reports errors without tokens', () => {
    setUrl(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Link+expired',
    );
    const got = captureAuthCallback();
    expect(got.params).toEqual({
      error: 'access_denied',
      error_code: 'otp_expired',
      error_description: 'Link expired',
    });
    expect(window.location.hash).toBe('');
  });
});

describe('bootAuthCallback', () => {
  it('only acts on /auth/callback', () => {
    setUrl('/account#access_token=a');
    bootAuthCallback();
    expect(readAuthCallback()).toBeNull();
    expect(window.location.hash).toBe('#access_token=a');
  });

  it('captures on /auth/callback and keeps the value until cleared', () => {
    setUrl('/auth/callback/#access_token=a&refresh_token=r');
    bootAuthCallback();
    expect(window.location.hash).toBe('');
    expect(readAuthCallback()?.params.access_token).toBe('a');
    expect(readAuthCallback()?.params.access_token).toBe('a');
    clearAuthCallback();
    expect(readAuthCallback()).toBeNull();
  });
});
