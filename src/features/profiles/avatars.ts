/**
 * Gradient avatar catalogue for profiles.
 *
 * A profile stores its avatar as a short id (e.g. "ember"). The gradient
 * itself lives in tokens.css (`--avatar-<id>`) and is applied through the
 * `.lf-avatar[data-avatar="<id>"]` selector, so no colours are hard-coded in
 * TS and no external images are needed.
 *
 * Older profiles (and the store's default profile) may carry an emoji or other
 * arbitrary string; `resolveAvatarId` maps any unknown value deterministically
 * onto a catalogue entry so it still renders as a gradient.
 */

export interface AvatarOption {
  id: string;
  label: string;
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'lagoon', label: 'Lagoon' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'ember', label: 'Ember' },
  { id: 'meadow', label: 'Meadow' },
  { id: 'gold', label: 'Gold' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'rose', label: 'Rose' },
] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number]['id'];

const AVATAR_IDS = new Set(AVATAR_OPTIONS.map((a) => a.id));

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATAR_IDS.has(value);
}

/** Small, stable string hash (FNV-1a, 32-bit). */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Maps any stored avatar value onto a known gradient id. */
export function resolveAvatarId(value: string | null | undefined): AvatarId {
  if (isAvatarId(value)) return value;
  if (!value) return AVATAR_OPTIONS[0].id;
  return AVATAR_OPTIONS[hash(value) % AVATAR_OPTIONS.length].id;
}

export function avatarLabel(value: string | null | undefined): string {
  const id = resolveAvatarId(value);
  return AVATAR_OPTIONS.find((a) => a.id === id)?.label ?? id;
}

/**
 * Picks an avatar for a new profile: the first catalogue entry not already in
 * use, cycling when every gradient is taken.
 */
export function suggestAvatar(taken: readonly string[]): AvatarId {
  const used = new Set(taken.map((t) => resolveAvatarId(t)));
  const free = AVATAR_OPTIONS.find((a) => !used.has(a.id));
  return free ? free.id : AVATAR_OPTIONS[taken.length % AVATAR_OPTIONS.length].id;
}

/** The glyph drawn on the tile: the first letter (grapheme-safe) of the name. */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0];
  return first.toLocaleUpperCase();
}
