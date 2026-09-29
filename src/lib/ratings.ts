import type { MediaType, Movie } from '../services/types';
import type { RatingEntry, Thumb, ThumbEntry, TitleId } from '../state/store';

/** A liked title that seeds a "Because you liked X" row. */
export interface LikedSeed {
  id: TitleId;
  mediaType: MediaType;
  /** May be unknown for older ratings; the row resolves it via the TMDB service. */
  title: string | null;
  /** Affinity score used for ordering (higher = liked more). */
  score: number;
  ratedAt: number;
}

/** Star rating at or above which a title counts as "liked". */
export const LIKED_MIN_STARS = 4;
/** Score a bare thumbs-up counts as: between 4 and 5 stars. */
const THUMB_UP_SCORE = 4.5;
/** Extra weight when a title has both stars and a thumbs-up. */
const THUMB_UP_BONUS = 0.5;

const MEDIA_TYPES: readonly MediaType[] = ['movie', 'tv'];
const titleKey = (mediaType: MediaType, id: TitleId) => `${mediaType}:${id}`;
const untypedKey = (id: TitleId) => `?:${id}`;

interface Merged {
  id: TitleId;
  mediaType?: MediaType;
  title: string | null;
  ratedAt: number;
  stars?: number;
  thumb?: Thumb;
}

/**
 * Combines thumbs and stars into the profile's top-liked titles.
 * A title is liked when it has a thumbs-up or at least LIKED_MIN_STARS stars,
 * and never when thumbed down. Titles without a known media type are skipped
 * (similar lookups need it). Ordered by score, then most recently rated.
 */
export function likedSeeds(ratings: readonly RatingEntry[], thumbs: readonly ThumbEntry[], limit = 2): LikedSeed[] {
  // Keyed by media type + id so a movie and a series sharing an id are separate seeds.
  // Untyped (legacy) entries merge with a typed entry for the same id when one exists.
  const byKey = new Map<string, Merged>();
  const findKey = (id: TitleId, mediaType?: MediaType): string | undefined => {
    if (mediaType) {
      const typed = titleKey(mediaType, id);
      if (byKey.has(typed)) return typed;
      return byKey.has(untypedKey(id)) ? untypedKey(id) : undefined;
    }
    for (const type of MEDIA_TYPES) if (byKey.has(titleKey(type, id))) return titleKey(type, id);
    return byKey.has(untypedKey(id)) ? untypedKey(id) : undefined;
  };
  const keyFor = (e: Merged) => (e.mediaType ? titleKey(e.mediaType, e.id) : untypedKey(e.id));

  for (const r of ratings) {
    const entry: Merged = { id: r.titleId, mediaType: r.mediaType, title: r.title ?? null, ratedAt: r.ratedAt, stars: r.rating };
    const key = keyFor(entry);
    if (!byKey.has(key)) byKey.set(key, entry);
  }
  for (const t of thumbs) {
    const prevKey = findKey(t.titleId, t.mediaType);
    const prev = prevKey ? byKey.get(prevKey) : undefined;
    if (prevKey) byKey.delete(prevKey);
    const entry: Merged = {
      id: t.titleId,
      mediaType: t.mediaType ?? prev?.mediaType,
      title: t.title ?? prev?.title ?? null,
      ratedAt: Math.max(t.ratedAt, prev?.ratedAt ?? 0),
      stars: prev?.stars,
      thumb: t.thumb,
    };
    const key = keyFor(entry);
    if (!byKey.has(key)) byKey.set(key, entry);
  }

  const out: LikedSeed[] = [];
  for (const e of byKey.values()) {
    if (!e.mediaType || e.thumb === 'down') continue;
    const likedByStars = e.stars !== undefined && e.stars >= LIKED_MIN_STARS;
    if (!likedByStars && e.thumb !== 'up') continue;
    const score = e.stars !== undefined ? e.stars + (e.thumb === 'up' ? THUMB_UP_BONUS : 0) : THUMB_UP_SCORE;
    out.push({ id: e.id, mediaType: e.mediaType, title: e.title, score, ratedAt: e.ratedAt });
  }
  out.sort((a, b) => b.score - a.score || b.ratedAt - a.ratedAt || a.id - b.id);
  return out.slice(0, Math.max(0, limit));
}

/**
 * Titles to hide from recommendations, as `${mediaType}:${id}` keys (fu2), so rating
 * a movie never hides the series with the same id. Legacy entries without a media
 * type hide both.
 */
export function ratedTitleKeys(ratings: readonly RatingEntry[], thumbs: readonly ThumbEntry[]): Set<string> {
  const keys = new Set<string>();
  const add = (e: { titleId: TitleId; mediaType?: MediaType }) => {
    if (e.mediaType) keys.add(titleKey(e.mediaType, e.titleId));
    else MEDIA_TYPES.forEach((type) => keys.add(titleKey(type, e.titleId)));
  };
  ratings.forEach(add);
  thumbs.forEach(add);
  return keys;
}

/**
 * Titles to hide from recommendations: anything the profile already rated or thumbed.
 * @deprecated id-only; movie and TV ids collide. Prefer {@link ratedTitleKeys}.
 */
export function ratedTitleIds(ratings: readonly RatingEntry[], thumbs: readonly ThumbEntry[]): Set<TitleId> {
  const ids = new Set<TitleId>();
  ratings.forEach((r) => ids.add(r.titleId));
  thumbs.forEach((t) => ids.add(t.titleId));
  return ids;
}

/**
 * Filters "Because you liked" rows for display: drops already-rated titles and
 * titles shown in an earlier row, then caps each row. `exclude` holds either
 * `${mediaType}:${id}` keys (see ratedTitleKeys) or, for older callers, bare ids.
 */
export function dedupeRecommendationRows<R extends { items: Movie[] }>(
  rows: readonly R[],
  exclude: ReadonlySet<TitleId> | ReadonlySet<string>,
  limit = 12,
): R[] {
  const excluded = exclude as ReadonlySet<TitleId | string>;
  const seen = new Set<string>();
  return rows.map((row) => {
    const items: Movie[] = [];
    for (const m of row.items) {
      const key = `${m.mediaType}:${m.id}`;
      if (excluded.has(m.id) || excluded.has(key) || seen.has(key)) continue;
      seen.add(key);
      items.push(m);
      if (items.length >= limit) break;
    }
    return { ...row, items };
  });
}

export function becauseYouLikedTitle(title: string): string {
  return `Because you liked ${title}`;
}
