import { beforeEach, describe, expect, it } from 'vitest';
import { selectRatings, selectThumbFor, selectThumbs, useLastFrameStore } from './store';

const s = () => useLastFrameStore.getState();

describe('thumbs slice', () => {
  beforeEach(() => {
    const [first] = s().profiles;
    useLastFrameStore.setState({ profiles: [first], activeProfileId: first.id, ratings: {}, thumbs: {} });
  });

  it('sets, replaces and clears a thumb with metadata', () => {
    s().setThumb(1000, 'up', { mediaType: 'movie', title: 'Neon Drift' });
    expect(selectThumbFor(1000)(s())).toBe('up');
    expect(selectThumbs(s())[0]).toMatchObject({ titleId: 1000, mediaType: 'movie', title: 'Neon Drift' });

    s().setThumb(1000, 'down');
    expect(selectThumbFor(1000)(s())).toBe('down');
    expect(selectThumbs(s())).toHaveLength(1);

    s().setThumb(1000, null);
    expect(selectThumbFor(1000)(s())).toBeNull();
  });

  it('keeps thumbs per profile and drops them with the profile', () => {
    const first = s().activeProfileId!;
    s().setThumb(1, 'up');
    const other = s().addProfile({ name: 'Kid' });
    s().setActiveProfile(other.id);
    expect(selectThumbs(s())).toEqual([]);
    s().setThumb(2, 'down');
    s().setActiveProfile(first);
    expect(selectThumbs(s()).map((e) => e.titleId)).toEqual([1]);
    s().removeProfile(other.id);
    expect(s().thumbs[other.id]).toBeUndefined();
  });

  it('stores rating metadata and keeps it when re-rated without meta', () => {
    s().rateTitle(5, 4, { mediaType: 'tv', title: 'Show' });
    s().rateTitle(5, 5);
    expect(selectRatings(s())[0]).toMatchObject({ titleId: 5, rating: 5, mediaType: 'tv', title: 'Show' });
  });
});
