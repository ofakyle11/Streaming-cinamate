import { describe, expect, it } from 'vitest';
import type { Movie } from '../services/types';
import {
  continueWatching,
  isViewEntry,
  recentlyViewed,
  relativeTime,
  removeView,
  restoreView,
  upsertView,
  viewKey,
  viewToMovie,
  type ViewEntry,
} from './viewHistory';

function movie(id: number, mediaType: Movie['mediaType'] = 'movie'): Movie {
  return {
    id,
    mediaType,
    title: `Title ${id}`,
    year: 2020,
    rating: 'PG',
    match: 90,
    genres: ['Drama'],
    description: 'A long description that history should not keep.',
    poster: `/p/${id}.jpg`,
    backdrop: `/b/${id}.jpg`,
    runtime: 100,
  };
}

describe('upsertView', () => {
  it('inserts new titles at the front with timestamps and no description', () => {
    let list: ViewEntry[] = [];
    list = upsertView(list, movie(1), 'open', 1000);
    list = upsertView(list, movie(2), 'open', 2000);
    expect(list.map((e) => e.key)).toEqual(['movie:2', 'movie:1']);
    expect(list[1]).toMatchObject({ firstViewedAt: 1000, lastViewedAt: 1000, views: 1 });
    expect(list[1].trailerPlayedAt).toBeUndefined();
    expect('description' in list[1].title).toBe(false);
  });

  it('moves a repeat view to the front, keeps firstViewedAt and counts views', () => {
    let list = upsertView([], movie(1), 'open', 1000);
    list = upsertView(list, movie(2), 'open', 2000);
    list = upsertView(list, movie(1), 'trailer', 3000);
    expect(list.map((e) => e.key)).toEqual(['movie:1', 'movie:2']);
    expect(list[0]).toMatchObject({ firstViewedAt: 1000, lastViewedAt: 3000, trailerPlayedAt: 3000, views: 2 });
    // A later plain open keeps the earlier trailer play.
    list = upsertView(list, movie(1), 'open', 4000);
    expect(list[0]).toMatchObject({ lastViewedAt: 4000, trailerPlayedAt: 3000, views: 3 });
  });

  it('keeps movie and tv titles with the same id apart', () => {
    const list = upsertView(upsertView([], movie(7, 'movie'), 'open', 1), movie(7, 'tv'), 'open', 2);
    expect(list.map((e) => e.key)).toEqual(['tv:7', 'movie:7']);
    expect(viewKey({ mediaType: 'tv', id: 7 })).toBe('tv:7');
  });

  it('caps the log, dropping the oldest', () => {
    let list: ViewEntry[] = [];
    for (let i = 0; i < 5; i++) list = upsertView(list, movie(i), 'open', i, 3);
    expect(list.map((e) => e.title.id)).toEqual([4, 3, 2]);
  });

  it('removes a single entry', () => {
    const list = upsertView(upsertView([], movie(1), 'open', 1), movie(2), 'open', 2);
    expect(removeView(list, 'movie:1').map((e) => e.key)).toEqual(['movie:2']);
  });
});

describe('restoreView', () => {
  function build(): ViewEntry[] {
    let list: ViewEntry[] = [];
    list = upsertView(list, movie(1), 'open', 1000);
    list = upsertView(list, movie(2), 'trailer', 2000);
    list = upsertView(list, movie(2), 'open', 2500);
    list = upsertView(list, movie(3), 'open', 3000);
    return list; // [3, 2, 1]
  }

  it('re-inserts the exact entry at its original position', () => {
    const list = build();
    const original = list[1];
    const restored = restoreView(removeView(list, original.key), original);
    expect(restored.map((e) => e.key)).toEqual(['movie:3', 'movie:2', 'movie:1']);
    expect(restored[1]).toEqual(original);
    expect(restored[1]).toMatchObject({ firstViewedAt: 2000, lastViewedAt: 2500, trailerPlayedAt: 2000, views: 2 });
  });

  it('restores oldest and newest entries to the ends', () => {
    const list = build();
    expect(restoreView(removeView(list, 'movie:1'), list[2]).map((e) => e.key)).toEqual(['movie:3', 'movie:2', 'movie:1']);
    expect(restoreView(removeView(list, 'movie:3'), list[0]).map((e) => e.key)).toEqual(['movie:3', 'movie:2', 'movie:1']);
    expect(restoreView([], list[0])).toEqual([list[0]]);
  });

  it('is a no-op when the key is already present', () => {
    const list = build();
    const stale: ViewEntry = { ...list[1], lastViewedAt: 1, views: 99 };
    const out = restoreView(list, stale);
    expect(out).toEqual(list);
    expect(out.find((e) => e.key === 'movie:2')?.views).toBe(2);
  });

  it('respects the limit', () => {
    const list = build();
    expect(restoreView(removeView(list, 'movie:3'), list[0], 2).map((e) => e.key)).toEqual(['movie:3', 'movie:2']);
    // An entry older than everything in a full list is dropped again.
    expect(restoreView(removeView(list, 'movie:1'), list[2], 2).map((e) => e.key)).toEqual(['movie:3', 'movie:2']);
  });
});

describe('continueWatching / recentlyViewed', () => {
  const views = [
    upsertView([], movie(3), 'open', 300)[0],
    upsertView([], movie(2), 'trailer', 200)[0],
    upsertView([], movie(1), 'open', 100)[0],
    upsertView([], movie(4), 'trailer', 50)[0],
  ];

  it('continue watching = trailer plays + in-progress playback, minus completed', () => {
    const playback = [
      { titleId: 1, position: 600, completed: false },
      { titleId: 4, position: 5000, completed: true },
    ];
    expect(continueWatching(views, playback).map((e) => e.title.id)).toEqual([2, 1]);
  });

  it('recently viewed excludes continue-watching titles and respects the limit', () => {
    const cw = continueWatching(views);
    expect(cw.map((e) => e.title.id)).toEqual([2, 4]);
    expect(recentlyViewed(views, cw).map((e) => e.title.id)).toEqual([3, 1]);
    expect(recentlyViewed(views, [], 2).map((e) => e.title.id)).toEqual([3, 2]);
  });

  it('viewToMovie rebuilds a Movie for cards', () => {
    expect(viewToMovie(views[0])).toMatchObject({ id: 3, mediaType: 'movie', title: 'Title 3', description: '' });
  });
});

describe('relativeTime', () => {
  const now = 10 * 24 * 3600 * 1000;
  it.each([
    [now - 5_000, 'just now'],
    [now - 5 * 60_000, '5m ago'],
    [now - 3 * 3600_000, '3h ago'],
    [now - 2 * 86400_000, '2d ago'],
  ])('%s -> %s', (ts, label) => {
    expect(relativeTime(ts, now)).toBe(label);
  });
});

describe('isViewEntry', () => {
  it('accepts real entries and rejects junk', () => {
    expect(isViewEntry(upsertView([], movie(1), 'open', 1)[0])).toBe(true);
    expect(isViewEntry(null)).toBe(false);
    expect(isViewEntry({ key: 'movie:1', lastViewedAt: 1 })).toBe(false);
    expect(isViewEntry({ key: 'x', lastViewedAt: 1, title: { id: 1, mediaType: 'film', title: 't', genres: [] } })).toBe(false);
  });
});
