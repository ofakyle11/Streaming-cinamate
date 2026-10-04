import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  BRAND_PREVIEW_KEY,
  clearBrandPreview,
  parseBrandPreview,
  setBrandPreview,
  useActiveBrand,
} from './activeBrand';
import { useBrandFavicon } from './useBrandFavicon';
import { ACTIVE_BRAND } from './marks';
import Navbar from '../Navbar';

describe('parseBrandPreview', () => {
  it('accepts a known mark and colourway only', () => {
    expect(parseBrandPreview(JSON.stringify({ mark: 'strip', colourway: 'dusk' }))).toEqual({
      mark: 'strip',
      colourway: 'dusk',
    });
    expect(parseBrandPreview(null)).toBeNull();
    expect(parseBrandPreview('not json')).toBeNull();
    expect(parseBrandPreview(JSON.stringify({ mark: 'nope', colourway: 'dusk' }))).toBeNull();
    expect(parseBrandPreview(JSON.stringify({ mark: 'strip' }))).toBeNull();
    expect(parseBrandPreview(JSON.stringify(['strip', 'dusk']))).toBeNull();
  });
});

describe('useActiveBrand', () => {
  beforeEach(() => {
    window.localStorage.removeItem(BRAND_PREVIEW_KEY);
  });
  afterEach(() => {
    window.localStorage.removeItem(BRAND_PREVIEW_KEY);
  });

  it('returns the shipped brand when nothing is stored', () => {
    const { result } = renderHook(() => useActiveBrand());
    expect(result.current.mark).toBe(ACTIVE_BRAND.mark);
    expect(result.current.colourway).toBe(ACTIVE_BRAND.colourway);
    expect(result.current.isPreview).toBe(false);
  });

  it('follows a preview set from anywhere and clears back to the default', () => {
    const { result } = renderHook(() => useActiveBrand());
    act(() => setBrandPreview({ mark: 'frame', colourway: 'lagoon' }));
    expect(result.current).toMatchObject({ mark: 'frame', colourway: 'lagoon', isPreview: true });
    expect(window.localStorage.getItem(BRAND_PREVIEW_KEY)).toBe(
      JSON.stringify({ mark: 'frame', colourway: 'lagoon' }),
    );
    act(() => clearBrandPreview());
    expect(result.current.isPreview).toBe(false);
    expect(result.current.mark).toBe(ACTIVE_BRAND.mark);
  });

  it('ignores garbage left in storage', () => {
    window.localStorage.setItem(BRAND_PREVIEW_KEY, '{"mark":"zzz"}');
    const { result } = renderHook(() => useActiveBrand());
    expect(result.current.isPreview).toBe(false);
  });

  it('swaps the Navbar mark only while a preview is set', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    const logo = screen.getByRole('link', { name: 'Lastframe.tv home' });
    // The shipped Lumen mark, until a kit preview swaps in an alternative.
    expect(logo.querySelector('svg')).not.toBeNull();
    expect(logo.querySelector('[data-mark]')).toBeNull();
    act(() => setBrandPreview({ mark: 'strip', colourway: 'ember' }));
    expect(logo.querySelector('svg')).toHaveAttribute('data-mark', 'strip');
    act(() => clearBrandPreview());
    expect(logo.querySelector('[data-mark]')).toBeNull();
  });
});

describe('useBrandFavicon', () => {
  let link: HTMLLinkElement;
  beforeEach(() => {
    window.localStorage.removeItem(BRAND_PREVIEW_KEY);
    link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('type', 'image/svg+xml');
    link.setAttribute('href', '/favicon.svg');
    document.head.appendChild(link);
  });
  afterEach(() => {
    link.remove();
    window.localStorage.removeItem(BRAND_PREVIEW_KEY);
  });

  it('swaps the SVG favicon for a data URI during a preview and restores it after', () => {
    const { unmount } = renderHook(() => useBrandFavicon());
    expect(link.getAttribute('href')).toBe('/favicon.svg');
    act(() => setBrandPreview({ mark: 'countdown', colourway: 'dusk' }));
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(href)).toContain('stop-color="#ec4899"');
    act(() => clearBrandPreview());
    expect(link.getAttribute('href')).toBe('/favicon.svg');
    act(() => setBrandPreview({ mark: 'frame', colourway: 'aurora' }));
    unmount();
    expect(link.getAttribute('href')).toBe('/favicon.svg');
  });
});
