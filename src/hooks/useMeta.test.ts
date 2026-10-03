import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DESCRIPTION, formatTitle, useMeta } from './useMeta';

function meta(attr: 'name' | 'property', key: string): HTMLMetaElement | undefined {
  return Array.from(document.head.getElementsByTagName('meta')).find(
    (m) => m.getAttribute(attr) === key,
  );
}

function canonicalLinks(): HTMLLinkElement[] {
  return Array.from(document.head.getElementsByTagName('link')).filter(
    (l) => l.getAttribute('rel') === 'canonical',
  );
}

describe('useMeta', () => {
  beforeEach(() => {
    document.title = 'Lastframe.tv';
    const desc = document.createElement('meta');
    desc.setAttribute('name', 'description');
    desc.setAttribute('content', 'Original description');
    document.head.appendChild(desc);
  });

  afterEach(() => {
    Array.from(document.head.getElementsByTagName('meta')).forEach((m) => m.remove());
    canonicalLinks().forEach((l) => l.remove());
    window.history.replaceState(null, '', '/');
  });

  it('formats titles with the site name', () => {
    expect(formatTitle('Search')).toBe('Search · Lastframe.tv');
    expect(formatTitle('  ')).toBe('Lastframe.tv');
    expect(formatTitle()).toBe('Lastframe.tv');
  });

  it('sets title, description, OpenGraph and Twitter tags', () => {
    renderHook(() =>
      useMeta({ title: 'Search', description: 'Find things', image: '/poster.jpg' }),
    );
    expect(document.title).toBe('Search · Lastframe.tv');
    expect(meta('name', 'description')?.getAttribute('content')).toBe('Find things');
    expect(meta('property', 'og:title')?.getAttribute('content')).toBe('Search · Lastframe.tv');
    expect(meta('property', 'og:description')?.getAttribute('content')).toBe('Find things');
    expect(meta('property', 'og:type')?.getAttribute('content')).toBe('website');
    expect(meta('property', 'og:image')?.getAttribute('content')).toBe(
      `${window.location.origin}/poster.jpg`,
    );
    expect(meta('property', 'og:url')?.getAttribute('content')).toMatch(/^http/);
    expect(meta('name', 'twitter:card')?.getAttribute('content')).toBe('summary');
    expect(meta('name', 'twitter:title')?.getAttribute('content')).toBe('Search · Lastframe.tv');
    // Only one description tag: the existing one is updated, not duplicated.
    expect(
      Array.from(document.head.getElementsByTagName('meta')).filter(
        (m) => m.getAttribute('name') === 'description',
      ),
    ).toHaveLength(1);
  });

  it('falls back to defaults and ignores data: images', () => {
    renderHook(() => useMeta({ image: 'data:image/svg+xml,<svg/>' }));
    expect(document.title).toBe('Lastframe.tv');
    expect(meta('name', 'description')?.getAttribute('content')).toBe(DEFAULT_DESCRIPTION);
    expect(meta('property', 'og:image')?.getAttribute('content')).toBe(
      `${window.location.origin}/apple-touch-icon.png`,
    );
  });

  it('restores previous values on unmount and removes tags it created', () => {
    const { unmount } = renderHook(() => useMeta({ title: 'Plans', description: 'Pick one' }));
    expect(document.title).toBe('Plans · Lastframe.tv');
    unmount();
    expect(document.title).toBe('Lastframe.tv');
    expect(meta('name', 'description')?.getAttribute('content')).toBe('Original description');
    expect(meta('property', 'og:title')).toBeUndefined();
    expect(meta('name', 'twitter:title')).toBeUndefined();
  });

  it('updates when the inputs change', () => {
    const { rerender, unmount } = renderHook(({ title }) => useMeta({ title }), {
      initialProps: { title: 'Loading…' },
    });
    expect(document.title).toBe('Loading… · Lastframe.tv');
    rerender({ title: 'Dune' });
    expect(document.title).toBe('Dune · Lastframe.tv');
    expect(meta('property', 'og:title')?.getAttribute('content')).toBe('Dune · Lastframe.tv');
    unmount();
    expect(document.title).toBe('Lastframe.tv');
  });

  it('sets a canonical link per route with query and hash stripped', () => {
    window.history.replaceState(null, '', '/search?q=dune#results');
    const { rerender, unmount } = renderHook(({ title }) => useMeta({ title }), {
      initialProps: { title: 'Search' },
    });
    expect(canonicalLinks()).toHaveLength(1);
    expect(canonicalLinks()[0].getAttribute('href')).toBe(`${window.location.origin}/search`);
    expect(meta('property', 'og:url')?.getAttribute('content')).toBe(
      `${window.location.origin}/search?q=dune`,
    );

    window.history.replaceState(null, '', '/title/movie/42?ref=home');
    rerender({ title: 'Dune' });
    expect(canonicalLinks()).toHaveLength(1);
    expect(canonicalLinks()[0].getAttribute('href')).toBe(
      `${window.location.origin}/title/movie/42`,
    );

    unmount();
    expect(canonicalLinks()).toHaveLength(0);
  });

  it('updates an existing canonical link and restores it on unmount', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', 'https://lastframe.tv/');
    document.head.appendChild(link);
    window.history.replaceState(null, '', '/plans');

    const { unmount } = renderHook(() => useMeta({ title: 'Plans' }));
    expect(canonicalLinks()).toHaveLength(1);
    expect(link.getAttribute('href')).toBe(`${window.location.origin}/plans`);
    unmount();
    expect(canonicalLinks()).toHaveLength(1);
    expect(link.getAttribute('href')).toBe('https://lastframe.tv/');
  });

  it('does not add a robots meta by default', () => {
    renderHook(() => useMeta({ title: 'Home' }));
    expect(meta('name', 'robots')).toBeUndefined();
  });

  it('adds robots noindex when requested and removes it on unmount', () => {
    const { unmount } = renderHook(() => useMeta({ title: 'Page not found', noindex: true }));
    expect(meta('name', 'robots')?.getAttribute('content')).toBe('noindex');
    unmount();
    expect(meta('name', 'robots')).toBeUndefined();
  });

  it('removes robots noindex when the option turns off', () => {
    const { rerender, unmount } = renderHook(({ noindex }) => useMeta({ noindex }), {
      initialProps: { noindex: true },
    });
    expect(meta('name', 'robots')?.getAttribute('content')).toBe('noindex');
    rerender({ noindex: false });
    expect(meta('name', 'robots')).toBeUndefined();
    unmount();
  });
});
