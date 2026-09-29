import { beforeEach, describe, expect, it } from 'vitest';
import { dedupeRecommendationRows, likedSeeds, ratedTitleKeys } from '../lib/ratings';
import type { Movie } from '../services/types';
import {
  selectHistoryForTitle,
  selectIsInWatchlist,
  selectIsInWatchlistFor,
  selectRatingForTitle,
  selectThumbForTitle,
  selectWatchlist,
  useLastFrameStore,
  type RatingEntry,
  type ThumbEntry,
} from './store';

/** TMDB movie and TV ids overlap: movie 500 and tv 500 are two different titles. */
const ID = 500;
const s = () => useLastFrameStore.getState();

const card = (mediaType: Movie['mediaType']): Movie => ({
  id: ID,
  mediaType,
  title: `${mediaType} ${ID}`,
  year: 2020,
  rating: 'PG',
  match: 90,
  genres: [],
  description: '',
  poster: '',
  backdrop: '',
  runtime: 90,
});

beforeEach(() => {
  const [first] = s().profiles;
  useLastFrameStore.setState({
    profiles: [first],
    activeProfileId: first.id,
    watchlist: {},
    ratings: {},
    thumbs: {},
    history: {},
  });
});

describe('title identity: My List', () => {
  it('adding the movie leaves the series with the same id unlisted', () => {
    s().toggleWatchlist(ID, 'movie');
    expect(selectIsInWatchlistFor(ID, 'movie')(s())).toBe(true);
    expect(selectIsInWatchlistFor(ID, 'tv')(s())).toBe(false);
  });

  it('both can be listed, and removing one keeps the other', () => {
    s().toggleWatchlist(ID, 'movie');
    s().toggleWatchlist(ID, 'tv');
    expect(selectWatchlist(s())).toHaveLength(2);

    s().toggleWatchlist(ID, 'movie');
    expect(selectIsInWatchlistFor(ID, 'movie')(s())).toBe(false);
    expect(selectIsInWatchlistFor(ID, 'tv')(s())).toBe(true);

    s().addToWatchlist(ID, 'movie');
    s().removeFromWatchlist(ID, 'tv');
    expect(selectWatchlist(s())).toEqual([expect.objectContaining({ titleId: ID, mediaType: 'movie' })]);
  });

  it('legacy entries without a media type still match both, and id-only callers behave as before', () => {
    s().addToWatchlist(ID);
    expect(selectIsInWatchlistFor(ID, 'movie')(s())).toBe(true);
    expect(selectIsInWatchlistFor(ID, 'tv')(s())).toBe(true);
    expect(selectIsInWatchlist(ID)(s())).toBe(true);

    // Removing either type clears the ambiguous legacy entry.
    s().toggleWatchlist(ID, 'tv');
    expect(selectWatchlist(s())).toEqual([]);

    s().addToWatchlist(ID, 'movie');
    s().addToWatchlist(ID, 'tv');
    s().removeFromWatchlist(ID);
    expect(selectWatchlist(s())).toEqual([]);
  });
});

describe('title identity: thumbs and stars', () => {
  it('thumbing one does not affect the other', () => {
    s().setThumb(ID, 'up', { mediaType: 'movie', title: 'Film' }, 'movie');
    expect(selectThumbForTitle(ID, 'movie')(s())).toBe('up');
    expect(selectThumbForTitle(ID, 'tv')(s())).toBeNull();

    s().setThumb(ID, 'down', { mediaType: 'tv', title: 'Show' }, 'tv');
    expect(selectThumbForTitle(ID, 'movie')(s())).toBe('up');
    expect(selectThumbForTitle(ID, 'tv')(s())).toBe('down');

    s().setThumb(ID, null, undefined, 'movie');
    expect(selectThumbForTitle(ID, 'movie')(s())).toBeNull();
    expect(selectThumbForTitle(ID, 'tv')(s())).toBe('down');
  });

  it('star ratings are kept per media type', () => {
    s().rateTitle(ID, 5, { mediaType: 'movie', title: 'Film' }, 'movie');
    s().rateTitle(ID, 2, undefined, 'tv');
    expect(selectRatingForTitle(ID, 'movie')(s())).toBe(5);
    expect(selectRatingForTitle(ID, 'tv')(s())).toBe(2);

    s().clearRating(ID, 'tv');
    expect(selectRatingForTitle(ID, 'movie')(s())).toBe(5);
    expect(selectRatingForTitle(ID, 'tv')(s())).toBeNull();
  });

  it('legacy thumbs and ratings without a media type match both', () => {
    s().setThumb(ID, 'up');
    s().rateTitle(ID, 4);
    for (const type of ['movie', 'tv'] as const) {
      expect(selectThumbForTitle(ID, type)(s())).toBe('up');
      expect(selectRatingForTitle(ID, type)(s())).toBe(4);
    }
  });
});

describe('title identity: history', () => {
  it('records progress per media type', () => {
    s().recordProgress(ID, 60, 600, 'movie');
    s().recordProgress(ID, 300, 600, 'tv');
    expect(selectHistoryForTitle(ID, 'movie')(s())).toMatchObject({ position: 60, mediaType: 'movie' });
    expect(selectHistoryForTitle(ID, 'tv')(s())).toMatchObject({ position: 300, mediaType: 'tv' });
  });
});

describe("title identity: 'Because you liked'", () => {
  const rating = (mediaType: RatingEntry['mediaType'], stars: RatingEntry['rating']): RatingEntry => ({
    titleId: ID,
    rating: stars,
    ratedAt: 1,
    mediaType,
    title: `${mediaType ?? 'legacy'} ${ID}`,
  });
  const thumb = (mediaType: ThumbEntry['mediaType'], value: ThumbEntry['thumb']): ThumbEntry => ({
    titleId: ID,
    thumb: value,
    ratedAt: 2,
    mediaType,
  });

  it('exclusion only hides the rated media type', () => {
    const exclude = ratedTitleKeys([rating('movie', 5)], []);
    const [row] = dedupeRecommendationRows([{ items: [card('movie'), card('tv')] }], exclude);
    expect(row.items.map((m) => m.mediaType)).toEqual(['tv']);
  });

  it('legacy entries without a media type hide both', () => {
    const exclude = ratedTitleKeys([], [thumb(undefined, 'up')]);
    const [row] = dedupeRecommendationRows([{ items: [card('movie'), card('tv')] }], exclude);
    expect(row.items).toEqual([]);
  });

  it('a thumbs-down on the series does not veto the liked movie', () => {
    const seeds = likedSeeds([rating('movie', 5)], [thumb('tv', 'down')], 5);
    expect(seeds).toEqual([expect.objectContaining({ id: ID, mediaType: 'movie' })]);
  });

  it('a movie and a series sharing an id are separate seeds', () => {
    const seeds = likedSeeds([rating('movie', 5)], [thumb('tv', 'up')], 5);
    expect(seeds.map((x) => x.mediaType).sort()).toEqual(['movie', 'tv']);
  });
});
