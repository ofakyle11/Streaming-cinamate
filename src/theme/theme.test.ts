import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  isThemePreference,
  readStoredTheme,
  resolveTheme,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  writeStoredTheme,
} from './theme';

function installMetas() {
  document.head.replaceChildren();
  for (const scheme of ['light', 'dark']) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('media', `(prefers-color-scheme: ${scheme})`);
    meta.setAttribute('content', '#000000');
    document.head.append(meta);
  }
}
const metaContents = () =>
  Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) =>
    m.getAttribute('content'),
  );

describe('theme storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    installMetas();
  });
  afterEach(() => vi.restoreAllMocks());

  it('uses the lf.theme key and falls back to system', () => {
    expect(THEME_STORAGE_KEY).toBe('lf.theme');
    expect(readStoredTheme()).toBe('system');
    localStorage.setItem('lf.theme', 'dark');
    expect(readStoredTheme()).toBe('dark');
    localStorage.setItem('lf.theme', 'sepia');
    expect(readStoredTheme()).toBe('system');
  });

  it('writes light and dark, and clears the key for system', () => {
    writeStoredTheme('dark');
    expect(localStorage.getItem('lf.theme')).toBe('dark');
    writeStoredTheme('system');
    expect(localStorage.getItem('lf.theme')).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredTheme()).toBe('system');
    expect(() => writeStoredTheme('dark')).not.toThrow();
  });

  it('validates preferences', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('resolves system from the device setting', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('applies the attribute and recolours both theme-color metas', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(metaContents()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);

    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(metaContents()).toEqual([THEME_COLORS.light, THEME_COLORS.light]);

    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(metaContents()).toEqual([THEME_COLORS.light, THEME_COLORS.dark]);
  });
});
