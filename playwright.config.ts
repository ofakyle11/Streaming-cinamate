import { defineConfig, devices, type PlaywrightTestConfig, type Project } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Use a preinstalled Chromium from PLAYWRIGHT_BROWSERS_PATH (e.g. /opt/pw-browsers)
 * when present, so the sandbox never needs `playwright install`. Otherwise fall back
 * to Playwright's default resolution (CI runs `npx playwright install chromium`).
 */
function localChromium(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = join(root, d, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const executablePath = localChromium();
const PORT = Number(process.env.E2E_PORT) || 4173;
const OUT_DIR = process.env.E2E_OUT_DIR || 'dist';

const SMOKE = /smoke\.spec\.ts/;
const SURFACES = /surfaces\.spec\.ts/;

type UseOptions = NonNullable<PlaywrightTestConfig['use']>;

/** One row of the device matrix: a viewport, an optional Playwright descriptor, phone flags. */
interface DeviceRow {
  /** Project name stem, e.g. `iphone-se` -> `iphone-se-light` / `iphone-se-dark`. */
  name: string;
  width: number;
  height: number;
  /** Playwright `devices[...]` descriptor to start from (UA, scale factor, touch). */
  descriptor?: keyof typeof devices;
  /** Phone-class device: mobile viewport meta + touch events. */
  phone?: boolean;
  /** Also run on WebKit when PW_WEBKIT is set (iPhone rows only). */
  webkit?: boolean;
}

const MATRIX: DeviceRow[] = [
  {
    name: 'iphone-se',
    width: 375,
    height: 667,
    descriptor: 'iPhone SE',
    phone: true,
    webkit: true,
  },
  {
    name: 'iphone-15-pro',
    width: 393,
    height: 852,
    descriptor: 'iPhone 15 Pro',
    phone: true,
    webkit: true,
  },
  { name: 'pixel-8', width: 412, height: 915, descriptor: 'Pixel 8', phone: true },
  { name: 'ipad-portrait', width: 768, height: 1024, descriptor: 'iPad (gen 7)' },
  { name: 'ipad-landscape', width: 1024, height: 768, descriptor: 'iPad (gen 7) landscape' },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const COLOR_SCHEMES = ['light', 'dark'] as const;

/** Base `use` for a matrix row: descriptor defaults, forced viewport, local Chromium. */
function deviceUse(row: DeviceRow, browserName: 'chromium' | 'webkit' = 'chromium'): UseOptions {
  const base = row.descriptor ? devices[row.descriptor] : devices['Desktop Chrome'];
  // `defaultBrowserType` from the descriptor is deliberately dropped: every project names its browser.
  const descriptor: Partial<typeof base> = { ...base };
  delete descriptor.defaultBrowserType;
  const use: UseOptions = {
    ...descriptor,
    browserName,
    viewport: { width: row.width, height: row.height },
    isMobile: !!row.phone || !!descriptor.isMobile,
    hasTouch: !!row.phone || !!descriptor.hasTouch,
  };
  if (browserName === 'chromium') use.launchOptions = executablePath ? { executablePath } : {};
  return use;
}

function surfacesProject(name: string, use: UseOptions): Project {
  return { name, testMatch: SURFACES, use };
}

/** 8 devices x light/dark on Chromium, plus WebKit for the iPhones in CI, plus two reduced-motion runs. */
function surfaceProjects(): Project[] {
  const projects: Project[] = [];
  for (const row of MATRIX) {
    for (const colorScheme of COLOR_SCHEMES) {
      projects.push(
        surfacesProject(`${row.name}-${colorScheme}`, { ...deviceUse(row), colorScheme }),
      );
      if (row.webkit && process.env.PW_WEBKIT) {
        projects.push(
          surfacesProject(`${row.name}-${colorScheme}-webkit`, {
            ...deviceUse(row, 'webkit'),
            colorScheme,
          }),
        );
      }
    }
  }
  for (const name of ['iphone-15-pro', 'desktop-1440']) {
    const row = MATRIX.find((r) => r.name === name)!;
    projects.push(
      surfacesProject(`${row.name}-reduced-motion`, {
        ...deviceUse(row),
        colorScheme: 'light',
        reducedMotion: 'reduce',
      }),
    );
  }
  return projects;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    serviceWorkers: 'block',
    // `/` is the landing page for a first-time visitor; every spec that expects
    // the app at `/` starts as a remembered guest (src/lib/guest.ts). The landing
    // page's own test clears the key.
    storageState: {
      cookies: [],
      origins: [
        { origin: `http://localhost:${PORT}`, localStorage: [{ name: 'lf.guest', value: '1' }] },
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      testMatch: SMOKE,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
    ...surfaceProjects(),
  ],
  webServer: {
    command: `npm run build -- --outDir ${OUT_DIR} && npm run preview -- --outDir ${OUT_DIR} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
