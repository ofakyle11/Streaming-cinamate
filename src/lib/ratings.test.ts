import { describe, expect, it } from 'vitest';
import type { Movie } from '../services/types';
import type { RatingEntry, ThumbEntry } from '../state/store';
import { becauseYouLikedTitle, dedupeRecommendationRows, likedSeeds, ratedTitleIds } from './ratings';

const r = (titleId: number, rating: RatingEntry['rating'], ratedAt: number, extra: Partial<RatingEntry> = {}): RatingEntry => ({
  titleId,
  rating,
  ratedAt,
  mediaType: 'movie',
  title: `T${titleId}`,
  ...extra,
});
const t = (titleId: number, thumb: ThumbEntry['thumb'], ratedAt: number, extra: Partial<ThumbEntry> = {}): ThumbEntry => ({
  titleId,
  thumb,
  ratedAt,
  mediaType: 'movie',
  title: `T${titleId}`,
  ...extra,
});
const m = (id: number, mediaType: Movie['mediaType'] = 'movie'): Movie => ({
  id,
  mediaType,
  title: `M${id}`,
  year: 2020,
  rating: 'PG',
  match: 90,
  genres: [],
  description: '',
  poster: '',
  backdrop: '',
  runtime: 90,
});

describe('likedSeeds', () => {
  it('returns nothing without likes', () => {
    expect(likedSeeds([], [])).toEqual([]);
    expect(likedSeeds([r(1, 3, 1)], [t(2, 'down', 2)])).toEqual([]);
  });

  it('counts 4+ stars and thumbs-up as liked, ordered by score then recency', () => {
    const seeds = likedSeeds([r(1, 4, 10), r(2, 5, 1), r(3, 2, 50)], [t(4, 'up', 20)], 5);
    expect(seeds.map((s) => s.id)).toEqual([2, 4, 1]);
    expect(seeds[0]).toMatchObject({ id: 2, mediaType: 'movie', title: 'T2', score: 5 });
  });

  it('boosts stars with a thumbs-up and excludes any thumbs-down', () => {
    const seeds = likedSeeds([r(1, 5, 1), r(2, 5, 1), r(3, 4, 1)], [t(1, 'down', 2), t(3, 'up', 2)], 5);
    expect(seeds.map((s) => [s.id, s.score])).toEqual([
      [2, 5],
      [3, 4.5],
    ]);
  });

  it('skips entries without a media type and respects the limit', () => {
    const seeds = likedSeeds([r(1, 5, 1, { mediaType: undefined })], [t(2, 'up', 1), t(3, 'up', 2), t(4, 'up', 3)], 2);
    expect(seeds.map((s) => s.id)).toEqual([4, 3]);
  });

  it('borrows metadata across stars and thumbs', () => {
    const [seed] = likedSeeds([r(7, 5, 1, { mediaType: 'tv', title: 'Show' })], [t(7, 'up', 5, { mediaType: undefined, title: undefined })]);
    expect(seed).toMatchObject({ id: 7, mediaType: 'tv', title: 'Show', ratedAt: 5 });
  });
});

describe('recommendation helpers', () => {
  it('collects every rated or thumbed id', () => {
    expect([...ratedTitleIds([r(1, 1, 1)], [t(2, 'down', 1)])].sort()).toEqual([1, 2]);
  });

  it('drops excluded and repeated titles across rows and caps rows', () => {
    const rows = dedupeRecommendationRows(
      [
        { id: 'a', items: [m(1), m(2), m(3)] },
        { id: 'b', items: [m(2), m(4), m(5), m(6)] },
      ],
      new Set([3]),
      2,
    );
    expect(rows.map((row) => row.items.map((x) => x.id))).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });

  it('titles the row', () => {
    expect(becauseYouLikedTitle('Neon Drift')).toBe('Because you liked Neon Drift');
  });
});
