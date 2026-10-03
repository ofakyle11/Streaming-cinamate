import { useCallback, useSyncExternalStore } from 'react';
import {
  DARK_SCHEME_QUERY,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

/*
 * A tiny external store: the preference comes from localStorage (shared with
 * public/theme-init.js), the resolved theme adds the device setting. Every
 * subscriber re-renders on setTheme, on a `storage` event from another tab and
 * when the device switches schemes, so a System change applies live.
 */
const listeners = new Set<() => void>();
let detachWindow: (() => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

/** Window-level listeners are attached once, while at least one hook is mounted. */
function attachWindow(): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === THEME_STORAGE_KEY) {
      applyTheme(readStoredTheme());
      emit();
    }
  };
  window.addEventListener('storage', onStorage);
  const mql = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_SCHEME_QUERY) : null;
  const onScheme = () => emit();
  // Older Safari only has addListener/removeListener.
  if (mql?.addEventListener) mql.addEventListener('change', onScheme);
  else mql?.addListener?.(onScheme);
  return () => {
    window.removeEventListener('storage', onStorage);
    if (mql?.removeEventListener) mql.removeEventListener('change', onScheme);
    else mql?.removeListener?.(onScheme);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!detachWindow) detachWindow = attachWindow();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detachWindow) {
      detachWindow();
      detachWindow = null;
    }
  };
}

const getPreference = (): ThemePreference => readStoredTheme();
const getResolved = (): ResolvedTheme => resolveTheme(readStoredTheme());
const serverPreference = (): ThemePreference => 'system';
const serverResolved = (): ResolvedTheme => 'light';

/** Sets, saves and applies a theme preference. Safe to call outside React. */
export function setTheme(pref: ThemePreference): void {
  writeStoredTheme(pref);
  applyTheme(pref);
  emit();
}

export interface UseTheme {
  /** What the person chose on this device: 'system' when they have not chosen. */
  preference: ThemePreference;
  /** The theme actually showing, after the device setting is applied. */
  resolved: ResolvedTheme;
  setTheme: (pref: ThemePreference) => void;
}

/** The current theme preference and the theme on screen, with a setter that persists. */
export function useTheme(): UseTheme {
  const preference = useSyncExternalStore(subscribe, getPreference, serverPreference);
  const resolved = useSyncExternalStore(subscribe, getResolved, serverResolved);
  const set = useCallback((pref: ThemePreference) => setTheme(pref), []);
  return { preference, resolved, setTheme: set };
}
