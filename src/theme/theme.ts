/**
 * Theme model for Lastframe.tv (Lumen): light by default, dark when the
 * device asks for it, or whatever the person picked on this device.
 *
 * The choice lives in localStorage (not the synced zustand store) because it
 * is a device preference and must be readable before React loads:
 * public/theme-init.js reads the same key before first paint. Keep the key,
 * values and colours here and in that file identical.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lf.theme';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Browser-chrome colours per theme (the two theme-color metas in index.html). */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#f6f5ff', // Cloud
  dark: '#141126', // Ink
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The saved preference, or 'system' when nothing valid is saved or storage is blocked. */
export function readStoredTheme(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/** Saves the preference; 'system' clears the key so the device decides. Storage errors are swallowed. */
export function writeStoredTheme(pref: ThemePreference): void {
  try {
    if (pref === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* private mode or storage quota: the attribute on <html> still applies for this page */
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_SCHEME_QUERY).matches
  );
}

export function resolveTheme(
  pref: ThemePreference,
  prefersDark = systemPrefersDark(),
): ResolvedTheme {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

/**
 * Puts the preference on <html> (data-theme="light|dark", or no attribute for
 * 'system', which lets themes.css follow prefers-color-scheme) and keeps the
 * theme-color metas in step so the browser chrome matches an explicit choice.
 */
export function applyTheme(pref: ThemePreference, doc: Document = document): void {
  const root = doc.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);

  const metas = doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((meta) => {
    const own: ResolvedTheme = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    meta.setAttribute('content', THEME_COLORS[pref === 'system' ? own : pref]);
  });
}
