import { beforeEach, describe, expect, it } from 'vitest';
import type { ViewedTitle } from '../lib/viewHistory';
import {
  selectActiveProfile,
  selectContinueWatching,
  selectHistory,
  selectHistoryFor,
  selectIsInWatchlist,
  selectIsInWatchlistFor,
  selectRatingFor,
  selectRatings,
  selectViews,
  selectWatchlist,
  useLastFrameStore,
} from './store';

const s = () => useLastFrameStore.getState();

describe('store slices', () => {
  beforeEach(() => {
    const [first] = s().profiles;
    useLastFrameStore.setState({
      profiles: [first],
      activeProfileId: first.id,
      watchlist: {},
      history: {},
      ratings: {},
      views: {},
      thumbs: {},
    });
  });

  it('manages profiles and keeps at least one', () => {
    const only = s().activeProfileId!;
    s().removeProfile(only);
    expect(s().profiles).toHaveLength(1);
    const p = s().addProfile({ name: '  ' });
    expect(p.name).toBe('Profile 2');
    s().updateProfile(p.id, { name: 'Kids', kid: true });
    s().setActiveProfile(p.id);
    expect(selectActiveProfile(s())).toMatchObject({ name: 'Kids', kid: true });
    s().setActiveProfile('nope');
    expect(s().activeProfileId).toBe(p.id);
    s().removeProfile(p.id);
    expect(s().activeProfileId).toBe(only);
  });

  it('toggles the watchlist per media type', () => {
    s().toggleWatchlist(10, 'movie');
    s().addToWatchlist(10, 'movie');
    expect(selectWatchlist(s())).toHaveLength(1);
    expect(selectIsInWatchlist(10)(s())).toBe(true);
    expect(selectIsInWatchlistFor(10, 'tv')(s())).toBe(false);
    s().toggleWatchlist(10, 'movie');
    expect(selectIsInWatchlist(10)(s())).toBe(false);
  });

  it('records progress, completion and continue-watching', () => {
    s().recordProgress(1, 30, 100, 'movie');
    s().recordProgress(2, 95, 100);
    expect(selectHistoryFor(2)(s())?.completed).toBe(true);
    expect(selectContinueWatching(s()).map((e) => e.titleId)).toEqual([1]);
    s().markCompleted(1);
    expect(selectHistoryFor(1)(s())).toMatchObject({ completed: true, position: 100, mediaType: 'movie' });
    s().clearHistory();
    expect(selectHistory(s())).toEqual([]);
  });

  it('rates, keeps prior metadata and clears ratings', () => {
    s().rateTitle(7, 4, { mediaType: 'tv', title: 'Show' });
    s().rateTitle(7, 5);
    expect(selectRatingFor(7)(s())).toBe(5);
    expect(selectRatings(s())[0]).toMatchObject({ title: 'Show', mediaType: 'tv' });
    s().clearRating(7);
    expect(selectRatingFor(7)(s())).toBeNull();
  });

  it('records, removes, restores and clears views', () => {
    const title = {
      id: 3,
      mediaType: 'movie',
      title: 'X',
      year: 2020,
      rating: 7,
      match: 90,
      genres: [],
      poster: '',
      backdrop: '',
    } as unknown as ViewedTitle;
    s().recordView(title, 'open');
    const [entry] = selectViews(s());
    expect(entry).toBeDefined();
    s().removeView(entry.key);
    expect(selectViews(s())).toEqual([]);
    s().restoreView(entry);
    expect(selectViews(s())).toHaveLength(1);
    s().clearViews();
    expect(selectViews(s())).toEqual([]);
  });

  it('no-ops every action without an active profile', () => {
    useLastFrameStore.setState({ activeProfileId: null });
    s().addToWatchlist(1);
    s().removeFromWatchlist(1);
    s().toggleWatchlist(1);
    s().recordProgress(1, 1, 2);
    s().markCompleted(1);
    s().clearHistory();
    s().rateTitle(1, 3);
    s().clearRating(1);
    s().clearViews();
    s().removeView('k');
    s().setThumb(1, 'up');
    expect(s().watchlist).toEqual({});
    expect(s().history).toEqual({});
    expect(s().ratings).toEqual({});
  });

  it('rehydrates persisted state through merge, dropping unknown active ids', async () => {
    const [first] = s().profiles;
    localStorage.setItem(
      'lastframe',
      JSON.stringify({
        state: { profiles: [first], activeProfileId: 'ghost', watchlist: { [first.id]: [{ titleId: 9, addedAt: 1 }] } },
        version: 1,
      }),
    );
    await useLastFrameStore.persist.rehydrate();
    expect(s().activeProfileId).toBe(first.id);
    expect(selectIsInWatchlist(9)(s())).toBe(true);
    localStorage.removeItem('lastframe');
  });
});
