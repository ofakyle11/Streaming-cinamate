import { describe, expect, it } from 'vitest';
import {
  AVATAR_OPTIONS,
  avatarInitial,
  avatarLabel,
  isAvatarId,
  resolveAvatarId,
  suggestAvatar,
} from '../avatars';
import {
  canAddProfile,
  canDeleteProfile,
  filterForProfile,
  isKidSafeRating,
  MAX_PROFILES,
  normalizeName,
  validateProfileName,
} from '../rules';

describe('avatars', () => {
  it('recognises catalogue ids only', () => {
    expect(isAvatarId('ember')).toBe(true);
    expect(isAvatarId('🎬')).toBe(false);
    expect(isAvatarId(undefined)).toBe(false);
  });

  it('resolves known ids to themselves and legacy values deterministically', () => {
    expect(resolveAvatarId('dusk')).toBe('dusk');
    const legacy = resolveAvatarId('🎬');
    expect(isAvatarId(legacy)).toBe(true);
    expect(resolveAvatarId('🎬')).toBe(legacy);
    expect(resolveAvatarId('')).toBe(AVATAR_OPTIONS[0].id);
    expect(resolveAvatarId(null)).toBe(AVATAR_OPTIONS[0].id);
  });

  it('labels avatars', () => {
    expect(avatarLabel('gold')).toBe('Gold');
  });

  it('suggests the first unused gradient, cycling when all are taken', () => {
    expect(suggestAvatar([])).toBe('aurora');
    expect(suggestAvatar(['aurora', 'lagoon'])).toBe('dusk');
    const all = AVATAR_OPTIONS.map((a) => a.id);
    expect(isAvatarId(suggestAvatar(all))).toBe(true);
  });

  it('derives an upper-case initial safely', () => {
    expect(avatarInitial('  zoe ')).toBe('Z');
    expect(avatarInitial('')).toBe('?');
    expect(avatarInitial('😀 Smiles')).toBe('😀');
  });
});

describe('profile rules', () => {
  const profiles = [
    { id: 'a', name: 'Alex' },
    { id: 'b', name: 'Sam  Lee' },
  ];

  it('normalises whitespace', () => {
    expect(normalizeName('  Jo   Ann ')).toBe('Jo Ann');
  });

  it('validates names', () => {
    expect(validateProfileName('   ', profiles)).toBe('empty');
    expect(validateProfileName('x'.repeat(21), profiles)).toBe('too-long');
    expect(validateProfileName('x'.repeat(20), profiles)).toBeNull();
    expect(validateProfileName('alex', profiles)).toBe('duplicate');
    expect(validateProfileName(' sam lee ', profiles)).toBe('duplicate');
    expect(validateProfileName('Alex', profiles, 'a')).toBeNull();
    expect(validateProfileName('Robin', profiles)).toBeNull();
  });

  it('limits profile count and keeps at least one', () => {
    expect(canAddProfile(new Array(MAX_PROFILES - 1).fill(0))).toBe(true);
    expect(canAddProfile(new Array(MAX_PROFILES).fill(0))).toBe(false);
    expect(canDeleteProfile([1])).toBe(false);
    expect(canDeleteProfile([1, 2])).toBe(true);
  });

  it('filters the catalogue for kids profiles', () => {
    const items = [{ rating: 'PG' }, { rating: 'R' }, { rating: 'tv-y7' }, { rating: 'TV-MA' }, { rating: '' }];
    expect(filterForProfile(items, { kid: true }).map((i) => i.rating)).toEqual(['PG', 'tv-y7']);
    expect(filterForProfile(items, { kid: false })).toHaveLength(5);
    expect(filterForProfile(items, null)).toHaveLength(5);
    expect(isKidSafeRating('G')).toBe(true);
    expect(isKidSafeRating('PG-13')).toBe(false);
    expect(isKidSafeRating(undefined)).toBe(false);
  });
});
