/**
 * "Browse as a guest" memory for the front door (next-phase plan, decision 1A).
 * A signed-out first-time visitor sees the landing page at `/`; once they choose
 * to browse as a guest the choice is remembered on this device in localStorage
 * (key `lf.guest`, beside `lf.theme`) and `/` goes straight to the app.
 * Signed-in users never see the landing page. Storage can be blocked (private
 * mode, site data off): every access is guarded and falls back to "not chosen".
 */
export const GUEST_KEY = 'lf.guest';
/** Fired on `window` after the choice changes in this tab (`storage` covers other tabs). */
export const GUEST_CHANGE_EVENT = 'lf:guest-change';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** True once the visitor chose "Browse as a guest" on this device. */
export function hasChosenGuest(store: Storage | null = storage()): boolean {
  try {
    return store?.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers the guest choice. Silently no-ops when storage is blocked. */
export function rememberGuest(store: Storage | null = storage()): void {
  try {
    store?.setItem(GUEST_KEY, '1');
  } catch {
    /* storage blocked: the landing page shows again next visit */
  }
  notify();
}

/** Forgets the guest choice (used when an account deletes its device data). */
export function forgetGuest(store: Storage | null = storage()): void {
  try {
    store?.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

function notify(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GUEST_CHANGE_EVENT));
}
