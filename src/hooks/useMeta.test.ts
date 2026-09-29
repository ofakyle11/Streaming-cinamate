import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DESCRIPTION, formatTitle, useMeta } from './useMeta';

function meta(attr: 'name' | 'property', key: string): HTMLMetaElement | undefined {
  return Array.from(document.head.getElementsByTagName('meta')).find(
    (m) => m.getAttribute(attr) === key,
  );
}

describe('useMeta', () => {
  beforeEach(() => {
    document.title = 'Last Frame';
    const desc = document.createElement('meta');
    desc.setAttribute('name', 'description');
    desc.setAttribute('content', 'Original description');
    document.head.appendChild(desc);
  });

  afterEach(() => {
    Array.from(document.head.getElementsByTagName('meta')).forEach((m) => m.remove());
  });

  it('formats titles with the site name', () => {
    expect(formatTitle('Search')).toBe('Search · Last Frame');
    expect(formatTitle('  ')).toBe('Last Frame');
    expect(formatTitle()).toBe('Last Frame');
  });

  it('sets title, description, OpenGraph and Twitter tags', () => {
    renderHook(() =>
      useMeta({ title: 'Search', description: 'Find things', image: '/poster.jpg' }),
    );
    expect(document.title).toBe('Search · Last Frame');
    expect(meta('name', 'description')?.getAttribute('content')).toBe('Find things');
    expect(meta('property', 'og:title')?.getAttribute('content')).toBe('Search · Last Frame');
    expect(meta('property', 'og:description')?.getAttribute('content')).toBe('Find things');
    expect(meta('property', 'og:type')?.getAttribute('content')).toBe('website');
    expect(meta('property', 'og:image')?.getAttribute('content')).toBe(
      `${window.location.origin}/poster.jpg`,
    );
    expect(meta('property', 'og:url')?.getAttribute('content')).toMatch(/^http/);
    expect(meta('name', 'twitter:card')?.getAttribute('content')).toBe('summary');
    expect(meta('name', 'twitter:title')?.getAttribute('content')).toBe('Search · Last Frame');
    // Only one description tag: the existing one is updated, not duplicated.
    expect(
      Array.from(document.head.getElementsByTagName('meta')).filter(
        (m) => m.getAttribute('name') === 'description',
      ),
    ).toHaveLength(1);
  });

  it('falls back to defaults and ignores data: images', () => {
    renderHook(() => useMeta({ image: 'data:image/svg+xml,<svg/>' }));
    expect(document.title).toBe('Last Frame');
    expect(meta('name', 'description')?.getAttribute('content')).toBe(DEFAULT_DESCRIPTION);
    expect(meta('property', 'og:image')?.getAttribute('content')).toBe(
      `${window.location.origin}/apple-touch-icon.png`,
    );
  });

  it('restores previous values on unmount and removes tags it created', () => {
    const { unmount } = renderHook(() => useMeta({ title: 'Plans', description: 'Pick one' }));
    expect(document.title).toBe('Plans · Last Frame');
    unmount();
    expect(document.title).toBe('Last Frame');
    expect(meta('name', 'description')?.getAttribute('content')).toBe('Original description');
    expect(meta('property', 'og:title')).toBeUndefined();
    expect(meta('name', 'twitter:title')).toBeUndefined();
  });

  it('updates when the inputs change', () => {
    const { rerender, unmount } = renderHook(({ title }) => useMeta({ title }), {
      initialProps: { title: 'Loading…' },
    });
    expect(document.title).toBe('Loading… · Last Frame');
    rerender({ title: 'Dune' });
    expect(document.title).toBe('Dune · Last Frame');
    expect(meta('property', 'og:title')?.getAttribute('content')).toBe('Dune · Last Frame');
    unmount();
    expect(document.title).toBe('Last Frame');
  });
});
