import type { DiscoverSort, TmdbTitle } from '../types';

/** Sort options in display order, with UI labels. */
export const DISCOVER_SORTS: ReadonlyArray<{ id: DiscoverSort; label: string }> = [
  { id: 'popularity', label: 'Popular' },
  { id: 'rating', label: 'Top rated' },
  { id: 'date', label: 'Newest' },
];

export const DEFAULT_DISCOVER_SORT: DiscoverSort = 'popularity';

export function isDiscoverSort(v: unknown): v is DiscoverSort {
  return v === 'popularity' || v === 'rating' || v === 'date';
}

const popularityOf = (t: TmdbTitle) => t.popularity ?? t.vote_average;

/**
 * Returns a new array sorted descending by the given key. Ties fall back to id
 * so the order is deterministic. Never mutates the input.
 */
export function sortTitles(items: readonly TmdbTitle[], sortBy: DiscoverSort = DEFAULT_DISCOVER_SORT): TmdbTitle[] {
  const cmp = (a: TmdbTitle, b: TmdbTitle): number => {
    switch (sortBy) {
      case 'rating':
        return b.vote_average - a.vote_average;
      case 'date':
        return (b.release_date ?? '').localeCompare(a.release_date ?? '');
      case 'popularity':
      default:
        return popularityOf(b) - popularityOf(a);
    }
  };
  return [...items].sort((a, b) => cmp(a, b) || a.id - b.id);
}

/** Maps our sort key to TMDB's `/discover` `sort_by` parameter. */
export function toTmdbSortParam(sortBy: DiscoverSort, mediaType: 'movie' | 'tv' = 'movie'): string {
  switch (sortBy) {
    case 'rating':
      return 'vote_average.desc';
    case 'date':
      return mediaType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
    case 'popularity':
    default:
      return 'popularity.desc';
  }
}
