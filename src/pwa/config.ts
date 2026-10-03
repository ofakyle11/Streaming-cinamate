/**
 * PWA build configuration (manifest + service worker caching).
 *
 * Pure data consumed by vite.config.ts through vite-plugin-pwa. Kept in src/
 * so the rules are typechecked and unit-tested alongside the app.
 */
import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';

/** Cloud: the light theme is the default, so the install splash and manifest chrome are light.
 *  The in-page theme-color metas (index.html, public/theme-init.js) follow the live theme. */
export const PWA_THEME_COLOR = '#f6f5ff';

/** Source SVG for the generated icon set (relative to the project root). */
export const PWA_LOGO_SOURCE = 'public/logo.svg';

export const IMAGE_CACHE_NAME = 'lf-images';
export const IMAGE_CACHE_MAX_ENTRIES = 250;
export const IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const pwaManifest: Partial<ManifestOptions> = {
  name: 'Last Frame',
  short_name: 'Last Frame',
  description: 'Stream films and series with Last Frame.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: PWA_THEME_COLOR,
  background_color: PWA_THEME_COLOR,
  lang: 'en',
  categories: ['entertainment'],
  // icons are generated from PWA_LOGO_SOURCE by the pwaAssets integration.
};

interface ImageMatchContext {
  request: Pick<Request, 'destination'>;
  url: Pick<URL, 'pathname' | 'hostname' | 'protocol'>;
  /** Provided by Workbox: true when the request targets the SW's own origin. */
  sameOrigin: boolean;
}

/**
 * Matches image requests the service worker may cache: anything the browser
 * fetches as an image (<img>, CSS backgrounds) plus explicit fetches of image
 * files, limited to origins allowed by the Content-Security-Policy connect-src
 * in netlify.toml ('self' and https://image.tmdb.org).
 *
 * Inside a service worker the fetch() Workbox makes is checked against
 * connect-src, not img-src. Any other image host (mock posters/avatars on
 * picsum.photos, YouTube thumbnails on i.ytimg.com) is left unhandled so the
 * browser loads it directly under img-src instead of failing inside the SW.
 *
 * NOTE: workbox-build serialises this function into the generated service
 * worker with Function#toString, so it must stay self-contained (no imports,
 * no references to module scope).
 */
export function isImageRequest({ request, url, sameOrigin }: ImageMatchContext): boolean {
  const allowedOrigin =
    sameOrigin || (url.protocol === 'https:' && url.hostname === 'image.tmdb.org');
  if (!allowedOrigin) return false;
  return (
    request.destination === 'image' || /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname)
  );
}

type WorkboxOptions = NonNullable<VitePWAOptions['workbox']>;

export const pwaWorkbox: WorkboxOptions = {
  globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: '/index.html',
  // Serverless functions and API proxies must always hit the network.
  navigateFallbackDenylist: [/^\/\.netlify\//, /^\/api\//],
  runtimeCaching: [
    {
      urlPattern: isImageRequest,
      handler: 'CacheFirst',
      options: {
        cacheName: IMAGE_CACHE_NAME,
        expiration: {
          maxEntries: IMAGE_CACHE_MAX_ENTRIES,
          maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
          purgeOnQuotaError: true,
        },
        // 0 = opaque cross-origin responses (e.g. poster CDNs without CORS).
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
};

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: 'script-defer',
  manifest: pwaManifest,
  pwaAssets: {
    config: true,
    overrideManifestIcons: true,
    // Off: index.html carries two theme-color metas (light and dark) that theme-init.js keeps in step.
    injectThemeColor: false,
    includeHtmlHeadLinks: true,
  },
  workbox: pwaWorkbox,
  devOptions: { enabled: false },
};
