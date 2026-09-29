import { describe, expect, it } from 'vitest';
import { createMockTmdb, MOCK_GENRES } from './tmdb/mock';
import { loadTitleDetails, pickTrailerKey } from './title';
import type { MediaType, TmdbService, TmdbTitle, TmdbTitleDetails, TmdbVideo } from './types';

const base: TmdbTitle = {
  id: 7,
  media_type: 'movie',
  title: 'Stub',
  overview: 'o',
  poster_path: '/p',
  backdrop_path: '/b',
  genre_ids: [28],
  vote_average: 7,
  release_date: '2020-01-01',
  runtime: 100,
};

function stubSvc(details: Partial<TmdbTitleDetails>): TmdbService {
  const mock = createMockTmdb();
  return {
    ...mock,
    async details() {
      return { ...base, ...details };
    },
  };
}

const vid = (key: string, type: string, official: boolean, site = 'YouTube'): TmdbVideo => ({
  id: key,
  key,
  name: key,
  site,
  type,
  official,
});

describe('loadTitleDetails (mock adapter)', () => {
  const svc = createMockTmdb();

  it.each<MediaType>(['movie', 'tv'])('resolves a %s id taken from search results', async (type) => {
    const { results } = await svc.search('the', 1, { mediaType: type });
    expect(results.length).toBeGreaterThan(0);
    const hit = results[0];
    const view = await loadTitleDetails(type, hit.id, svc);
    expect(view).not.toBeNull();
    expect(view!.movie.id).toBe(hit.id);
    expect(view!.movie.mediaType).toBe(type);
    expect(view!.movie.title).toBe(hit.title ?? hit.name);
    const names = hit.genre_ids.map((g) => MOCK_GENRES.find((x) => x.id === g)!.name);
    expect(view!.movie.genres).toEqual(names);
    expect(view!.cast.length).toBeGreaterThan(0);
    expect(view!.cast.length).toBeLessThanOrEqual(12);
    expect(view!.cast[0].profile).toMatch(/^https:\/\//);
    expect(view!.similar.length).toBeGreaterThan(0);
    expect(view!.similar.length).toBeLessThanOrEqual(20);
  });

  it('resolves every id reachable from search, genre and discover results', async () => {
    const pages = await Promise.all([
      svc.search('a'),
      svc.search('e', 2),
      svc.discover({}),
      svc.discover({ page: 2 }),
      svc.discover({ page: 3 }),
      ...MOCK_GENRES.map((g) => svc.byGenre(g.id)),
      ...MOCK_GENRES.map((g) => svc.byGenre(g.id, { mediaType: 'tv' })),
      svc.trending(),
      svc.popular('tv'),
      svc.upcoming(),
    ]);
    const refs = new Map(pages.flatMap((p) => p.results).map((t) => [`${t.media_type}:${t.id}`, t]));
    expect(refs.size).toBeGreaterThan(20);
    const refList = [...refs.values()];
    const found = await Promise.all(refList.map((t) => svc.details(t.media_type, t.id)));
    const missing = refList.filter((_, i) => !found[i]).map((t) => `${t.media_type}/${t.id}`);
    expect(missing).toEqual([]);
  }, 15000);

  it('returns null for an unknown id', async () => {
    expect(await loadTitleDetails('movie', 987654, svc)).toBeNull();
  });

  it('returns null for a bad type or id', async () => {
    expect(await loadTitleDetails('person' as MediaType, 1000, svc)).toBeNull();
    expect(await loadTitleDetails('movie', NaN, svc)).toBeNull();
    expect(await loadTitleDetails('movie', -3, svc)).toBeNull();
    expect(await loadTitleDetails('movie', 1.5, svc)).toBeNull();
  });
});

describe('trailer selection', () => {
  it('prefers the first official YouTube Trailer', async () => {
    const svc = stubSvc({
      videos: [
        vid('teaser', 'Teaser', true),
        vid('vimeo', 'Trailer', true, 'Vimeo'),
        vid('unofficial', 'Trailer', false),
        vid('official', 'Trailer', true),
        vid('official2', 'Trailer', true),
      ],
    });
    expect((await loadTitleDetails('movie', 7, svc))?.trailerKey).toBe('official');
  });

  it('falls back to the first YouTube Teaser/Trailer', async () => {
    const svc = stubSvc({
      videos: [vid('clip', 'Clip', true), vid('vimeo', 'Trailer', true, 'Vimeo'), vid('teaser', 'Teaser', false), vid('t', 'Trailer', false)],
    });
    expect((await loadTitleDetails('movie', 7, svc))?.trailerKey).toBe('teaser');
  });

  it('is undefined without usable videos', async () => {
    expect(pickTrailerKey(undefined)).toBeUndefined();
    expect(pickTrailerKey([vid('c', 'Clip', true)])).toBeUndefined();
  });
});

describe('view mapping', () => {
  it('caps cast at 12 and similar at 20, prefers recommendations, maps region providers', async () => {
    const svc = stubSvc({
      credits: {
        cast: Array.from({ length: 15 }, (_, i) => ({
          id: i,
          name: `P${i}`,
          character: `C${i}`,
          profile_path: i === 0 ? '' : `/p${i}`,
          order: 14 - i,
        })),
        crew: [],
      },
      similar: [{ ...base, id: 99 }],
      recommendations: Array.from({ length: 25 }, (_, i) => ({ ...base, id: 100 + i })),
      watchProviders: {
        US: { flatrate: [{ provider_id: 1, provider_name: 'A', logo_path: '/a', display_priority: 2 }] },
        CA: { flatrate: [{ provider_id: 2, provider_name: 'B', logo_path: '/b', display_priority: 1 }] },
      },
    });
    const view = (await loadTitleDetails('movie', 7, svc))!;
    expect(view.cast).toHaveLength(12);
    expect(view.cast[0]).toMatchObject({ name: 'P14', character: 'C14' });
    expect(view.similar).toHaveLength(20);
    expect(view.similar[0].id).toBe(100);
    expect(view.providers?.map((p) => p.provider_name)).toEqual(['A']);
    const ca = (await loadTitleDetails('movie', 7, svc, 'CA'))!;
    expect(ca.providers?.map((p) => p.provider_name)).toEqual(['B']);
    const none = (await loadTitleDetails('movie', 7, svc, 'GB'))!;
    expect(none.providers).toBeUndefined();
  });

  it('falls back to similar when there are no recommendations', async () => {
    const svc = stubSvc({ similar: [{ ...base, id: 99 }], recommendations: [] });
    expect((await loadTitleDetails('movie', 7, svc))!.similar.map((m) => m.id)).toEqual([99]);
  });
});
