import { describe, expect, it } from 'vitest';
import {
  IMAGE_CACHE_NAME,
  isImageRequest,
  PWA_LOGO_SOURCE,
  pwaManifest,
  pwaOptions,
  pwaWorkbox,
} from './config';

const ctx = (destination: string, pathname: string) => ({
  request: { destination } as Pick<Request, 'destination'>,
  url: { pathname },
});

describe('pwa manifest', () => {
  it('names the app Last Frame with the brand theme colour', () => {
    expect(pwaManifest.name).toBe('Last Frame');
    expect(pwaManifest.short_name).toBe('Last Frame');
    expect(pwaManifest.theme_color).toBe('#0b0b12');
    expect(pwaManifest.background_color).toBe('#0b0b12');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
  });

  it('generates icons from the SVG logo mark', () => {
    expect(PWA_LOGO_SOURCE).toBe('public/logo.svg');
    expect(pwaOptions.pwaAssets).toMatchObject({ config: true, overrideManifestIcons: true });
  });
});

describe('isImageRequest', () => {
  it('matches requests the browser makes for images', () => {
    expect(isImageRequest(ctx('image', '/t/p/w500/abc'))).toBe(true);
  });

  it('matches fetches of image files by extension', () => {
    for (const p of ['/a.png', '/b.JPG', '/c.jpeg', '/d.webp', '/e.avif', '/f.gif', '/logo.svg', '/favicon.ico']) {
      expect(isImageRequest(ctx('', p))).toBe(true);
    }
  });

  it('ignores scripts, documents and API calls', () => {
    expect(isImageRequest(ctx('script', '/assets/index.js'))).toBe(false);
    expect(isImageRequest(ctx('document', '/title/42'))).toBe(false);
    expect(isImageRequest(ctx('', '/.netlify/functions/health'))).toBe(false);
    expect(isImageRequest(ctx('', '/api/png'))).toBe(false);
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
