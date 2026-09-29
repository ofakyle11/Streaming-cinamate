import { STORAGE_KEY, useLastFrameStore, type Profile } from '../state/store';

/** localStorage keys owned by Last Frame: the zustand store and every `lf.*` key. */
export function isLastFrameKey(key: string): boolean {
  return key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}.`) || key.startsWith('lf.');
}

function newProfileId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wipe everything Last Frame keeps on this device (profiles, list, history,
 * ratings, mock session/db) and reset the in-memory store to a fresh guest.
 * Returns the number of storage keys removed.
 */
export function clearLocalData(): number {
  let removed = 0;
  try {
    const ls = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k && isLastFrameKey(k)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
    removed = keys.length;
  } catch {
    /* storage unavailable: only the in-memory reset below applies */
  }

  const profile: Profile = { id: newProfileId(), name: 'Me', avatar: '🎬', kid: false, createdAt: Date.now() };
  useLastFrameStore.setState({
    profiles: [profile],
    activeProfileId: profile.id,
    watchlist: {},
    history: {},
    ratings: {},
  });
  return removed;
}
