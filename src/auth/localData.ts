import { STORAGE_KEY, useLastFrameStore } from '../state/store';
import { freshGuestState } from '../services/db/sync';
import { clearSyncOwner } from '../services/db/syncEngine';
import { forgetGuest } from '../lib/guest';

/** localStorage keys owned by Lastframe.tv: the zustand store and every `lf.*` key. */
export function isLastFrameKey(key: string): boolean {
  return key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}.`) || key.startsWith('lf.');
}

/**
 * Wipe everything Lastframe.tv keeps on this device (profiles, list, history,
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

  useLastFrameStore.setState(freshGuestState());
  // The `lf.guest` key went with the rest; notify FrontDoor so the landing page returns.
  forgetGuest();
  return removed;
}

/**
 * After sign-out: reset the synced store data (profiles, watchlist, history,
 * ratings) to a fresh guest and mark it as guest data again. The account's
 * copy stays in the cloud, and its unsent-edit queue stays under its own key
 * for the next sign-in. Other preferences are kept.
 */
export function resetSyncedData(): void {
  useLastFrameStore.setState(freshGuestState());
  clearSyncOwner();
}
