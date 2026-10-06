import { describe, expect, it } from 'vitest';

/**
 * Guard: every analytics call site in UI code must go through the typed
 * `track()` helper in src/services/analytics/track.ts, so event names stay in
 * sync with `AnalyticsEvents` (Plausible goals key off them).
 */
const sources = {
  ...import.meta.glob('/src/pages/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('/src/components/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('/src/hooks/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>;

const isTest = (path: string) => /\.test\.tsx?$/.test(path) || path.includes('/test/');

const FORBIDDEN = ["analytics.track('", 'analytics.track("', "'title_open'", '"title_open"'];

describe('analytics call sites', () => {
  const files = Object.entries(sources).filter(([path]) => !isTest(path));

  it('scans the UI source tree', () => {
    expect(files.some(([path]) => path.endsWith('/src/pages/NewPopularPage.tsx'))).toBe(true);
    expect(files.length).toBeGreaterThan(5);
  });

  it('uses the typed track() helper instead of raw analytics.track or legacy event names', () => {
    const offenders = files.flatMap(([path, text]) =>
      FORBIDDEN.filter((needle) => text.includes(needle)).map((needle) => `${path}: ${needle}`),
    );
    expect(offenders).toEqual([]);
  });
});
