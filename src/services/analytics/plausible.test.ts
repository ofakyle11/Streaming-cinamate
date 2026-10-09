import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPlausibleAnalytics,
  PLAUSIBLE_SCRIPT_ID,
  toPlausibleProps,
  type PlausibleWindow,
} from './plausible';

const win = window as PlausibleWindow;

function queued(): unknown[][] {
  return (win.plausible?.q ?? []) as unknown[][];
}

describe('plausible adapter', () => {
  beforeEach(() => {
    delete win.plausible;
    document.getElementById(PLAUSIBLE_SCRIPT_ID)?.remove();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    delete win.plausible;
    document.getElementById(PLAUSIBLE_SCRIPT_ID)?.remove();
  });

  it('does nothing until the first call, then injects a single script element', () => {
    const a = createPlausibleAnalytics({ domain: 'lastframe.tv' });
    expect(document.getElementById(PLAUSIBLE_SCRIPT_ID)).toBeNull();

    a.track('search', { query: 'dune' });
    a.track('search', { query: 'alien' });

    const scripts = document.querySelectorAll(`#${PLAUSIBLE_SCRIPT_ID}`);
    expect(scripts).toHaveLength(1);
    const s = scripts[0] as HTMLScriptElement;
    expect(s.tagName).toBe('SCRIPT');
    expect(s.src).toBe('https://plausible.io/js/script.manual.js');
    expect(s.getAttribute('data-domain')).toBe('lastframe.tv');
    expect(s.hasAttribute('data-api')).toBe(false);
    expect(s.defer).toBe(true);
  });

  it('uses a custom host for script + api when configured', () => {
    const a = createPlausibleAnalytics({
      domain: 'lastframe.tv',
      apiHost: 'https://stats.example.com/',
    });
    a.track('play-trailer');
    const s = document.getElementById(PLAUSIBLE_SCRIPT_ID) as HTMLScriptElement;
    expect(s.src).toBe('https://stats.example.com/js/script.manual.js');
    expect(s.getAttribute('data-api')).toBe('https://stats.example.com/api/event');
  });

  it('queues events with filtered props before the script loads', () => {
    const a = createPlausibleAnalytics({ domain: 'lastframe.tv' });
    a.track('add-to-list', { id: 7, list: 'watchlist', note: undefined, x: null, ok: true });
    a.track('play-trailer');
    expect(queued()).toEqual([
      ['add-to-list', { props: { id: 7, list: 'watchlist', ok: true } }],
      ['play-trailer'],
    ]);
  });

  it('forwards to an already-loaded plausible function', () => {
    const fn = vi.fn();
    win.plausible = fn;
    createPlausibleAnalytics({ domain: 'lastframe.tv' }).track('search', { query: 'x' });
    expect(fn).toHaveBeenCalledWith('search', { props: { query: 'x' } });
  });

  it('sends manual pageviews with an explicit url, without the query string, and dedupes repeats', () => {
    const a = createPlausibleAnalytics({ domain: 'lastframe.tv' });
    a.page('/search', { path: '/search?q=dune' }); // the search term never leaves the browser
    a.page('search'); // same URL? no: falls back to location ("/")
    a.page('/', { path: '/' }); // duplicate of previous URL -> skipped
    a.page('/title/movie/1', { path: '/title/movie/1' });
    const origin = window.location.origin;
    expect(queued()).toEqual([
      ['pageview', { u: `${origin}/search`, props: { page: '/search' } }],
      ['pageview', { u: `${origin}/`, props: { page: 'search' } }],
      ['pageview', { u: `${origin}/title/movie/1`, props: { page: '/title/movie/1' } }],
    ]);
  });

  it('drops the query string of the current location too', () => {
    window.history.replaceState(null, '', '/search?q=secret+film#x');
    try {
      const a = createPlausibleAnalytics({ domain: 'lastframe.tv' });
      a.page('search');
      expect(queued()).toEqual([
        ['pageview', { u: `${window.location.origin}/search`, props: { page: 'search' } }],
      ]);
      expect(JSON.stringify(queued())).not.toContain('secret');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('never forwards identify data', () => {
    const fn = vi.fn();
    win.plausible = fn;
    createPlausibleAnalytics({ domain: 'lastframe.tv' }).identify('user-1', { email: 'a@b.c' });
    expect(fn).not.toHaveBeenCalled();
    expect(document.getElementById(PLAUSIBLE_SCRIPT_ID)).toBeNull();
  });

  it('swallows errors thrown by the plausible function', () => {
    win.plausible = () => {
      throw new Error('blocked');
    };
    const a = createPlausibleAnalytics({ domain: 'lastframe.tv' });
    expect(() => a.track('search')).not.toThrow();
  });
});

describe('plausible adapter without a DOM (SSR)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a safe no-op', () => {
    const a = createPlausibleAnalytics({ domain: 'lastframe.tv' });
    vi.stubGlobal('window', undefined);
    expect(() => {
      a.identify('u1');
      a.track('search', { query: 'dune' });
      a.page('/', { path: '/' });
    }).not.toThrow();
    vi.unstubAllGlobals();
    expect(document.getElementById(PLAUSIBLE_SCRIPT_ID)).toBeNull();
    expect(win.plausible).toBeUndefined();
  });
});

describe('toPlausibleProps', () => {
  it('drops nullish values and returns undefined when empty', () => {
    expect(toPlausibleProps(undefined)).toBeUndefined();
    expect(toPlausibleProps({ a: null, b: undefined })).toBeUndefined();
    expect(toPlausibleProps({ a: 1, b: 'x', c: false })).toEqual({ a: 1, b: 'x', c: false });
  });
});
