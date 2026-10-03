import type { TmdbVideo, TmdbWatchProviders } from '../../services';

const SAFE_KEY = /^[\w-]{1,64}$/;

/** Everything keyboard-reachable inside a dialog, in DOM order (used by the trailer modal's focus trap). */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'iframe',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  "[tabindex]:not([tabindex='-1'])",
].join(', ');

/** Embeddable player URL for a TMDB video, or null when the site/key is not supported. */
export function trailerEmbedUrl(video: TmdbVideo, autoplay = true): string | null {
  if (!SAFE_KEY.test(video.key)) return null;
  const key = encodeURIComponent(video.key);
  const ap = autoplay ? 1 : 0;
  if (video.site === 'YouTube') {
    return `https://www.youtube-nocookie.com/embed/${key}?autoplay=${ap}&rel=0&modestbranding=1`;
  }
  if (video.site === 'Vimeo') return `https://player.vimeo.com/video/${key}?autoplay=${ap}&dnt=1`;
  return null;
}

/** Up to two initials for monogram fallbacks ("Mara Vale" -> "MV", "Lumen+" -> "L"). */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  return parts
    .slice(0, 2)
    .map((p) => (p.match(/[\p{L}\p{N}]/u)?.[0] ?? '').toUpperCase())
    .join('');
}

export type OfferKind = keyof Omit<TmdbWatchProviders, 'region' | 'link'>;

/** Where-to-watch offer groups in display order. */
export const OFFER_GROUPS: { key: OfferKind; label: string }[] = [
  { key: 'flatrate', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'With ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

export function hasOffers(p: TmdbWatchProviders | null): boolean {
  return Boolean(p && OFFER_GROUPS.some((g) => (p[g.key]?.length ?? 0) > 0));
}
