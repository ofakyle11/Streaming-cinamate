import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_CACHE_NAME } from './config';
import { clearImageCache } from './imageCache';

describe('clearImageCache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deletes only the runtime image cache', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    await expect(clearImageCache()).resolves.toBe(true);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(IMAGE_CACHE_NAME);
  });

  it('resolves false when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(clearImageCache()).resolves.toBe(false);
  });

  it('resolves false instead of throwing when deletion rejects or throws', async () => {
    vi.stubGlobal('caches', { delete: vi.fn(() => Promise.reject(new Error('denied'))) });
    await expect(clearImageCache()).resolves.toBe(false);
    vi.stubGlobal('caches', {
      delete: () => {
        throw new Error('sync failure');
      },
    });
    await expect(clearImageCache()).resolves.toBe(false);
  });
});
