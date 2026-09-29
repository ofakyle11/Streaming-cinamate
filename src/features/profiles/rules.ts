import type { Profile } from '../../state/store';

/** Maximum number of profiles per account. */
export const MAX_PROFILES = 5;
export const MAX_NAME_LENGTH = 20;

export type NameError = 'empty' | 'too-long' | 'duplicate';

export const NAME_ERROR_MESSAGES: Record<NameError, string> = {
  empty: 'Please enter a name.',
  'too-long': `Names can be up to ${MAX_NAME_LENGTH} characters.`,
  duplicate: 'Another profile already uses that name.',
};

/** Trims and collapses internal whitespace. */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Validates a profile name. Names are unique per account, compared
 * case-insensitively; `selfId` excludes the profile being edited.
 */
export function validateProfileName(
  name: string,
  profiles: readonly Pick<Profile, 'id' | 'name'>[],
  selfId?: string,
): NameError | null {
  const clean = normalizeName(name);
  if (!clean) return 'empty';
  if (Array.from(clean).length > MAX_NAME_LENGTH) return 'too-long';
  const key = clean.toLocaleLowerCase();
  if (profiles.some((p) => p.id !== selfId && normalizeName(p.name).toLocaleLowerCase() === key)) {
    return 'duplicate';
  }
  return null;
}

export function canAddProfile(profiles: readonly unknown[]): boolean {
  return profiles.length < MAX_PROFILES;
}

/** At least one profile must always exist. */
export function canDeleteProfile(profiles: readonly unknown[]): boolean {
  return profiles.length > 1;
}

/* ------------------------------------------------------------------ kids */

/** Certifications considered suitable for a kids profile (MPAA + US TV). */
export const KID_SAFE_RATINGS: ReadonlySet<string> = new Set(['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG']);

export function isKidSafeRating(rating: string | null | undefined): boolean {
  if (!rating) return false;
  return KID_SAFE_RATINGS.has(rating.trim().toUpperCase());
}

/**
 * Filters a catalogue for the given profile: kids profiles only see kid-safe
 * titles; everyone else sees everything. Unrated titles are hidden from kids.
 */
export function filterForProfile<T extends { rating: string }>(
  items: readonly T[],
  profile: Pick<Profile, 'kid'> | null | undefined,
): T[] {
  if (!profile?.kid) return [...items];
  return items.filter((i) => isKidSafeRating(i.rating));
}
