import { IMAGE_CACHE_NAME } from './config';

/**
 * Remove the service worker's runtime image cache (posters, backdrops) so no
 * record of browsed or watched titles stays on the device. The precache (app
 * shell) is left alone. Never throws: resolves true when a cache was deleted,
 * false when there was none, Cache Storage is unavailable, or deletion failed.
 */
export async function clearImageCache(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    return await caches.delete(IMAGE_CACHE_NAME);
  } catch {
    return false;
  }
}
