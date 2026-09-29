import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockTmdb, MOCK_GENRES } from '../services/tmdb/mock';
import type { Movie } from '../services/types';
import { selectWatchlist, useLastFrameStore } from '../state/store';
import { entryKey, resolveEntry, sortMyList } from './useMyListTitles';
import { myListToastMessage } from './useMyListToggle';

const movie = (id: number, title: string, year: number): Movie => ({
  id,
  mediaType: 'movie',
  title,
  year,
  rating: 'PG',
  match: 90,
  genres: [],
  description: '',
  poster: '',
  backdrop: '',
  runtime: 90,
});

describe('My List helpers', () => {
  it('sorts by added order, title and release year without mutating input', () => {
    const items = [movie(1, 'Zeta', 2019), movie(2, 'alpha', 2024), movie(3, 'Mid', 2021)];
    expect(sortMyList(items, 'added').map((m) => m.id)).toEqual([1, 2, 3]);
    expect(sortMyList(items, 'title').map((m) => m.id)).toEqual([2, 3, 1]);
    expect(sortMyList(items, 'year').map((m) => m.id)).toEqual([2, 3, 1]);
    expect(items.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('keys entries by media type and id', () => {
    expect(entryKey({ titleId: 5, mediaType: 'tv' })).toBe('tv:5');
    expect(entryKey({ titleId: 5 })).toBe('?:5');
  });

  it('resolves entries, falling back to tv for legacy entries without a media type', async () => {
    const svc = createMockTmdb();
    const details = vi.spyOn(svc, 'details');
    // 1002 ("Midnight Protocol") is a series in the mock catalogue.
    const m = await resolveEntry({ titleId: 1002, addedAt: 0 }, MOCK_GENRES, svc);
    expect(m).toMatchObject({ id: 1002, mediaType: 'tv', title: 'Midnight Protocol' });
    expect(details.mock.calls.map((c) => c[0])).toEqual(['movie', 'tv']);

    details.mockClear();
    expect(await resolveEntry({ titleId: 1000, addedAt: 0, mediaType: 'movie' }, MOCK_GENRES, svc)).toMatchObject({
      title: 'Neon Drift',
    });
    expect(details).toHaveBeenCalledTimes(1);
    expect(await resolveEntry({ titleId: 99999, addedAt: 0, mediaType: 'movie' }, MOCK_GENRES, svc)).toBeNull();
  });

  it('builds toast copy', () => {
    expect(myListToastMessage('Neon Drift', true)).toBe('Added Neon Drift to My List');
    expect(myListToastMessage('Neon Drift', false)).toBe('Removed Neon Drift from My List');
  });
});

describe('watchlist store: media type', () => {
  beforeEach(() => useLastFrameStore.setState({ watchlist: {} }));

  it('stores the media type on add and toggle, newest first', () => {
    const { addToWatchlist, toggleWatchlist } = useLastFrameStore.getState();
    addToWatchlist(1000, 'movie');
    toggleWatchlist(1002, 'tv');
    addToWatchlist(1003);
    const list = selectWatchlist(useLastFrameStore.getState());
    expect(list.map((e) => [e.titleId, e.mediaType])).toEqual([
      [1003, undefined],
      [1002, 'tv'],
      [1000, 'movie'],
    ]);
    toggleWatchlist(1002, 'tv');
    expect(selectWatchlist(useLastFrameStore.getState()).map((e) => e.titleId)).toEqual([1003, 1000]);
  });
});
