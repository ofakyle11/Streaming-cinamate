import { describe, expect, it } from 'vitest';
import {
  IMAGE_CACHE_NAME,
  isImageRequest,
  PWA_LOGO_SOURCE,
  pwaManifest,
  pwaOptions,
  pwaWorkbox,
} from './config';

const ctx = (destination: string, pathname: string, origin = 'self') => {
  const sameOrigin = origin === 'self';
  const parsed = new URL(pathname, sameOrigin ? 'https://lastframe.test' : origin);
  return {
    request: { destination } as Pick<Request, 'destination'>,
    url: { pathname: parsed.pathname, hostname: parsed.hostname, protocol: parsed.protocol },
    sameOrigin,
  };
};

describe('pwa manifest', () => {
  it('names the app Last Frame with the brand theme colour', () => {
    expect(pwaManifest.name).toBe('Last Frame');
    expect(pwaManifest.short_name).toBe('Last Frame');
    expect(pwaManifest.theme_color).toBe('#f6f5ff');
    expect(pwaManifest.background_color).toBe('#f6f5ff');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
  });

  it('generates icons from the SVG logo mark', () => {
    expect(PWA_LOGO_SOURCE).toBe('public/logo.svg');
    expect(pwaOptions.pwaAssets).toMatchObject({ config: true, overrideManifestIcons: true });
  });

  it('leaves the theme-color metas to index.html and theme-init.js', () => {
    expect(pwaOptions.pwaAssets).toMatchObject({ injectThemeColor: false });
  });
});

describe('isImageRequest', () => {
  it('matches requests the browser makes for images', () => {
    expect(isImageRequest(ctx('image', '/t/p/w500/abc'))).toBe(true);
  });

  it('matches fetches of image files by extension', () => {
    for (const p of [
      '/a.png',
      '/b.JPG',
      '/c.jpeg',
      '/d.webp',
      '/e.avif',
      '/f.gif',
      '/logo.svg',
      '/favicon.ico',
    ]) {
      expect(isImageRequest(ctx('', p))).toBe(true);
    }
  });

  it('ignores scripts, documents and API calls', () => {
    expect(isImageRequest(ctx('script', '/assets/index.js'))).toBe(false);
    expect(isImageRequest(ctx('document', '/title/42'))).toBe(false);
    expect(isImageRequest(ctx('', '/.netlify/functions/health'))).toBe(false);
    expect(isImageRequest(ctx('', '/api/png'))).toBe(false);
  });

  it('caches TMDB poster images (allowed by CSP connect-src)', () => {
    expect(isImageRequest(ctx('image', '/t/p/w500/abc.jpg', 'https://image.tmdb.org'))).toBe(true);
    expect(isImageRequest(ctx('', '/t/p/w500/abc.jpg', 'https://image.tmdb.org'))).toBe(true);
  });

  it('leaves images from hosts outside CSP connect-src to the browser', () => {
    for (const origin of [
      'https://picsum.photos',
      'https://fastly.picsum.photos',
      'https://i.ytimg.com',
      'https://evil.example',
      'https://image.tmdb.org.evil.example',
      'http://image.tmdb.org',
    ]) {
      expect(isImageRequest(ctx('image', '/id/1/300/450.jpg', origin))).toBe(false);
    }
  });

  it('stays self-contained so workbox can serialise it into the SW', () => {
    const src = isImageRequest.toString();
    expect(src).not.toMatch(/\bPWA_|\bIMAGE_CACHE/);
  });
});

describe('workbox runtime caching', () => {
  it('caches images cache-first with bounded expiry', () => {
    const rule = pwaWorkbox.runtimeCaching?.[0];
    expect(rule?.urlPattern).toBe(isImageRequest);
    expect(rule?.handler).toBe('CacheFirst');
    expect(rule?.options?.cacheName).toBe(IMAGE_CACHE_NAME);
    expect(rule?.options?.expiration?.maxEntries).toBeGreaterThan(0);
    expect(rule?.options?.expiration?.maxAgeSeconds).toBeGreaterThan(0);
    expect(rule?.options?.cacheableResponse?.statuses).toEqual([0, 200]);
  });

  it('never serves the SPA shell for serverless function routes', () => {
    const deny = pwaWorkbox.navigateFallbackDenylist ?? [];
    expect(deny.some((r) => r.test('/.netlify/functions/health'))).toBe(true);
    expect(deny.some((r) => r.test('/account'))).toBe(false);
  });
});
