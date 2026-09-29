import { describe, expect, it } from 'vitest';
import { createMockTmdb, MOCK_TITLES } from './mock';

describe('mock TMDB title extras', () => {
  const svc = createMockTmdb();

  it('credits are deterministic, ordered, and include monogram fallbacks', async () => {
    const a = await svc.credits('movie', 1000);
    const b = await svc.credits('movie', 1000);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.map((c) => c.order)).toEqual(a.map((_, i) => i));
    expect(a.some((c) => c.profile_path === null)).toBe(true);
    expect(new Set(a.map((c) => c.id)).size).toBe(a.length);
    expect(await svc.credits('tv', 1000)).toEqual([]);
  });

  it('similar titles share a genre and exclude the title itself', async () => {
    const self = MOCK_TITLES.find((t) => t.id === 1000)!;
    const page = await svc.similar('movie', 1000);
    expect(page.results.length).toBeGreaterThan(0);
    for (const t of page.results) {
      expect(t.id).not.toBe(1000);
      expect(t.genre_ids.some((g) => self.genre_ids.includes(g))).toBe(true);
    }
    expect((await svc.similar('movie', 424242)).results).toEqual([]);
  });

  it('videos: most titles have a trailer, every fifth has none', async () => {
    expect((await svc.videos('movie', 1000)).some((v) => v.type === 'Trailer')).toBe(true);
    const noTrailer = MOCK_TITLES[4];
    expect(await svc.videos(noTrailer.media_type, noTrailer.id)).toEqual([]);
  });

  it('watch providers differ by region and can be empty in CA', async () => {
    const us = await svc.watchProviders('movie', 1000, 'US');
    const ca = await svc.watchProviders('movie', 1000, 'CA');
    expect(us?.region).toBe('US');
    expect(ca?.region).toBe('CA');
    expect(us?.flatrate?.length).toBeGreaterThan(0);
    expect(us?.flatrate).not.toEqual(ca?.flatrate);

    const unavailable = MOCK_TITLES[6];
    const caEmpty = await svc.watchProviders(unavailable.media_type, unavailable.id, 'CA');
    expect(caEmpty?.flatrate).toBeUndefined();
    expect(await svc.watchProviders('movie', 424242, 'US')).toBeNull();
  });
});
