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
  const byId = new Map<TitleId, Merged>();
  for (const r of ratings) {
    byId.set(r.titleId, {
      id: r.titleId,
      mediaType: r.mediaType,
      title: r.title ?? null,
      ratedAt: r.ratedAt,
      stars: r.rating,
    });
  }
  for (const t of thumbs) {
    const prev = byId.get(t.titleId);
    byId.set(t.titleId, {
      id: t.titleId,
      mediaType: t.mediaType ?? prev?.mediaType,
      title: t.title ?? prev?.title ?? null,
      ratedAt: Math.max(t.ratedAt, prev?.ratedAt ?? 0),
      stars: prev?.stars,
      thumb: t.thumb,
    });
  }

  const out: LikedSeed[] = [];
  for (const e of byId.values()) {
    if (!e.mediaType || e.thumb === 'down') continue;
    const likedByStars = e.stars !== undefined && e.stars >= LIKED_MIN_STARS;
    if (!likedByStars && e.thumb !== 'up') continue;
    const score = e.stars !== undefined ? e.stars + (e.thumb === 'up' ? THUMB_UP_BONUS : 0) : THUMB_UP_SCORE;
    out.push({ id: e.id, mediaType: e.mediaType, title: e.title, score, ratedAt: e.ratedAt });
  }
  out.sort((a, b) => b.score - a.score || b.ratedAt - a.ratedAt || a.id - b.id);
  return out.slice(0, Math.max(0, limit));
}

/** Titles to hide from recommendations: anything the profile already rated or thumbed. */
export function ratedTitleIds(ratings: readonly RatingEntry[], thumbs: readonly ThumbEntry[]): Set<TitleId> {
  const ids = new Set<TitleId>();
  ratings.forEach((r) => ids.add(r.titleId));
  thumbs.forEach((t) => ids.add(t.titleId));
  return ids;
}

/**
 * Filters "Because you liked" rows for display: drops already-rated titles and
 * titles shown in an earlier row, then caps each row.
 */
export function dedupeRecommendationRows<R extends { items: Movie[] }>(
  rows: readonly R[],
  exclude: ReadonlySet<TitleId>,
  limit = 12,
): R[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const items: Movie[] = [];
    for (const m of row.items) {
      const key = `${m.mediaType}:${m.id}`;
      if (exclude.has(m.id) || seen.has(key)) continue;
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
