import { describe, expect, it } from 'vitest';
import { services, loadHomeCatalog } from '../services';

describe('wave 0 integration', () => {
  it('runs entirely on mock adapters with no env vars', () => {
    expect(services.mode).toEqual({ tmdb: 'mock', auth: 'mock', db: 'mock', billing: 'mock', analytics: 'mock' });
  });

  it('builds the home catalogue from the mock TMDB adapter', async () => {
    const { featured, rows } = await loadHomeCatalog();
    expect(featured.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
  });
});
