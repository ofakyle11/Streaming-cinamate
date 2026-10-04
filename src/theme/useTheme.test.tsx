import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTheme, useTheme } from './useTheme';

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => false,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    flip(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
    listeners,
  };
}

describe('useTheme', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('starts on system and resolves to the device scheme', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('system');
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('reads a preference saved before load (what theme-init.js saw)', () => {
    mockMatchMedia(false);
    localStorage.setItem('lf.theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('dark');
    expect(result.current.resolved).toBe('dark');
  });

  it('setTheme persists, applies to <html> and updates every subscriber', () => {
    mockMatchMedia(false);
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    act(() => a.result.current.setTheme('dark'));
    expect(localStorage.getItem('lf.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(b.result.current.preference).toBe('dark');
    expect(b.result.current.resolved).toBe('dark');

    act(() => setTheme('system'));
    expect(localStorage.getItem('lf.theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(a.result.current.resolved).toBe('light');
  });

  it('follows a live device change while on system', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('light');
    act(() => media.flip(true));
    expect(result.current.resolved).toBe('dark');
    act(() => result.current.setTheme('light'));
    act(() => media.flip(false));
    expect(result.current.resolved).toBe('light');
  });

  it('picks up a change made in another tab', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    localStorage.setItem('lf.theme', 'dark');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'lf.theme', newValue: 'dark' }));
    });
    expect(result.current.preference).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('unsubscribes from the media query on unmount', () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderHook(() => useTheme());
    expect(media.listeners.size).toBeGreaterThan(0);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
