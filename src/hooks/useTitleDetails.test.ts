import { describe, expect, it } from 'vitest';
import { createMockTmdb } from '../services/tmdb/mock';
import type { TmdbService, TmdbVideo } from '../services';
import {
  defaultWatchRegion,
  formatRuntime,
  loadTitleDetails,
  parseTitleParams,
  pickTrailer,
} from './useTitleDetails';

const video = (over: Partial<TmdbVideo>): TmdbVideo => ({
  id: 'v',
  key: 'k',
  name: 'n',
  site: 'YouTube',
  type: 'Trailer',
  official: true,
  ...over,
});

describe('parseTitleParams', () => {
  it('accepts movie/tv with a positive integer id', () => {
    expect(parseTitleParams('movie', '1000')).toEqual({ mediaType: 'movie', id: 1000 });
    expect(parseTitleParams('tv', '7')).toEqual({ mediaType: 'tv', id: 7 });
  });

  it.each([
    ['film', '1'],
    ['movie', undefined],
    ['movie', 'abc'],
    ['movie', '0'],
    ['movie', '-3'],
    ['movie', '1.5'],
    [undefined, '1'],
  ])('rejects %s/%s', (type, id) => {
    expect(parseTitleParams(type, id)).toBeNull();
  });
});

describe('pickTrailer', () => {
  it('prefers official trailers, then trailers, then teasers; ignores clips', () => {
    const clip = video({ id: 'c', type: 'Clip' });
    const teaser = video({ id: 't', type: 'Teaser' });
    const unofficial = video({ id: 'u', official: false });
    const official = video({ id: 'o' });
    expect(pickTrailer([clip, teaser, unofficial, official])?.id).toBe('o');
    expect(pickTrailer([clip, teaser, unofficial])?.id).toBe('u');
    expect(pickTrailer([clip, teaser])?.id).toBe('t');
    expect(pickTrailer([clip])).toBeNull();
    expect(pickTrailer([])).toBeNull();
  });
});

describe('formatRuntime', () => {
  it('formats minutes as h/m', () => {
    expect(formatRuntime(125)).toBe('2h 5m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(0)).toBe('');
    expect(formatRuntime(Number.NaN)).toBe('');
  });
});

describe('defaultWatchRegion', () => {
  it('maps Canadian locales to CA and everything else to US', () => {
    expect(defaultWatchRegion('en-CA')).toBe('CA');
    expect(defaultWatchRegion('fr_CA')).toBe('CA');
    expect(defaultWatchRegion('en-US')).toBe('US');
    expect(defaultWatchRegion('de-DE')).toBe('US');
    expect(defaultWatchRegion('')).toBe('US');
  });
});

describe('loadTitleDetails', () => {
  const svc = createMockTmdb();

  it('assembles movie, cast, similar and trailer from the mock adapter', async () => {
    const d = await loadTitleDetails('movie', 1000, svc);
    expect(d).not.toBeNull();
    expect(d?.movie.title).toBe('Neon Drift');
    expect(d?.movie.genres).toEqual(['Science Fiction', 'Action']);
    expect(d?.cast.length).toBeGreaterThan(0);
    expect(d?.cast.map((c) => c.order)).toEqual([...d!.cast.map((c) => c.order)].sort((a, b) => a - b));
    expect(d?.similar.length).toBeGreaterThan(0);
    expect(d?.similar.length).toBeLessThanOrEqual(12);
    expect(d?.similar.some((m) => m.id === 1000)).toBe(false);
    expect(d?.trailer?.type).toBe('Trailer');
  });

  it('returns null for unknown ids or mismatched media types', async () => {
    expect(await loadTitleDetails('movie', 99999, svc)).toBeNull();
    // 1002 is a TV title in the mock catalogue.
    expect(await loadTitleDetails('movie', 1002, svc)).toBeNull();
    expect(await loadTitleDetails('tv', 1002, svc)).not.toBeNull();
  });

  it('degrades secondary sections to empty when they fail', async () => {
    const failing: TmdbService = {
      ...svc,
      credits: () => Promise.reject(new Error('boom')),
      similar: () => Promise.reject(new Error('boom')),
      videos: () => Promise.reject(new Error('boom')),
    };
    const d = await loadTitleDetails('movie', 1000, failing);
    expect(d?.movie.title).toBe('Neon Drift');
    expect(d?.cast).toEqual([]);
    expect(d?.similar).toEqual([]);
    expect(d?.trailer).toBeNull();
  });

  it('propagates a failure of the primary details call', async () => {
    const failing: TmdbService = { ...svc, details: () => Promise.reject(new Error('offline')) };
    await expect(loadTitleDetails('movie', 1000, failing)).rejects.toThrow('offline');
  });
});
