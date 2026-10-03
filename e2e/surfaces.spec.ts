import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Responsive surface checks. Runs once per project in the device matrix
 * (see playwright.config.ts): phones, tablets and desktops, light and dark,
 * plus two reduced-motion projects.
 */

const PHONE_MAX = 480;
const TABLET_MAX = 1024;
const TITLE = 'Neon Drift';

function viewport() {
  const vp = test.info().project.use.viewport;
  if (!vp) throw new Error('surfaces.spec.ts needs a project with a fixed viewport');
  return vp;
}

/**
 * Bounding box once the element's entrance motion has finished: `boundingBox()` includes
 * in-flight transforms, so wait for every animation on the element and its subtree first.
 */
async function box(locator: Locator) {
  // The brand mark's halo breathes forever, so only finite animations are awaited.
  await locator.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const b = await locator.boundingBox();
  expect(b, `bounding box of ${locator}`).not.toBeNull();
  return b!;
}

/** The document never scrolls sideways: scrollWidth must not exceed the viewport. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = () =>
    page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return root.scrollWidth - window.innerWidth;
    });
  expect(await overflow(), 'horizontal overflow after load').toBeLessThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await overflow(), 'horizontal overflow after scrolling to the bottom').toBeLessThanOrEqual(
    0,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function openTitle(page: Page, name = TITLE) {
  await page.goto(`/search?q=${encodeURIComponent(name)}`);
  await page
    .getByRole('list', { name: 'Search results' })
    .getByRole('link', { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test.describe('home', () => {
  test('nav, hero, rows and menu fit the viewport', async ({ page }) => {
    const { width } = viewport();
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();
    expect((await box(nav)).height, 'nav height').toBeLessThanOrEqual(72);

    const hero = page.locator('section.hero');
    await expect(hero).toBeVisible();
    await expect(hero.getByRole('button', { name: 'Where to watch' })).toBeVisible();

    const screen = await box(hero.locator('.hero-screen'));
    if (width <= PHONE_MAX) {
      expect(Math.round(screen.x), 'hero screen is edge to edge on phones').toBe(0);
      expect(Math.round(screen.width), 'hero screen spans the viewport').toBe(width);
    } else {
      expect(screen.x, 'hero screen is inset above phone width').toBeGreaterThanOrEqual(16);
    }

    const firstRow = page.locator('section.row').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('a[href^="/title/"]').first()).toBeVisible();

    const series = nav.getByRole('link', { name: 'Series' });
    if (width <= TABLET_MAX) {
      const menu = nav.getByRole('button', { name: 'Menu' });
      await expect(menu).toBeVisible();
      const b = await box(menu);
      expect(b.width, 'menu button width').toBeGreaterThanOrEqual(44);
      expect(b.height, 'menu button height').toBeGreaterThanOrEqual(44);
      await menu.click();
      await expect(series).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(series).toBeHidden();
    } else {
      await expect(series).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Menu' })).toBeHidden();
    }

    await expectNoHorizontalScroll(page);
  });
});

test.describe('hover', () => {
  test('cards in the first row still scale on hover', async ({ page, hasTouch }) => {
    test.skip(hasTouch || viewport().width <= TABLET_MAX, 'desktop pointer projects only');
    await page.goto('/');
    const card = page.locator('.rows > .row').first().locator('.card').first();
    await box(card);
    await card.hover();
    await expect
      .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
      .toMatch(/^matrix\(1\.03/);
  });
});

test.describe('search', () => {
  test('inputs are at least 16px so phones never zoom', async ({ page }) => {
    await page.goto('/search');
    const inputs = page.locator('input');
    await expect(inputs.first()).toBeVisible();
    const sizes = await inputs.evaluateAll((els) =>
      els.map((el) => ({
        name: el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.tagName,
        size: parseFloat(getComputedStyle(el).fontSize),
      })),
    );
    for (const { name, size } of sizes) {
      expect(size, `font-size of input "${name}"`).toBeGreaterThanOrEqual(16);
    }
  });
});

test.describe('title page', () => {
  test('where to watch scrolls into view and the trailer sheet fits the device', async ({
    page,
  }) => {
    const { width } = viewport();
    await openTitle(page);

    await page.getByRole('button', { name: 'Where to watch' }).first().click();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.getElementById('where-to-watch');
            if (!el) return 'missing';
            const { top } = el.getBoundingClientRect();
            return top >= 0 && top <= window.innerHeight ? 'in-view' : `top=${Math.round(top)}`;
          }),
        { message: '#where-to-watch is inside the viewport' },
      )
      .toBe('in-view');

    await page.getByRole('button', { name: 'Trailer' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const innerHeight = await page.evaluate(() => window.innerHeight);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    const b = await box(dialog);
    if (width <= TABLET_MAX) {
      expect(
        Math.abs(b.y + b.height - innerHeight),
        'bottom sheet sits on the bottom edge',
      ).toBeLessThanOrEqual(2);
      expect(Math.round(b.width), 'bottom sheet spans the viewport').toBe(innerWidth);
    } else {
      const centre = b.x + b.width / 2;
      expect(
        Math.abs(centre - innerWidth / 2),
        'dialog is horizontally centred',
      ).toBeLessThanOrEqual(2);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('a finger drag on the sheet handle closes the trailer', async ({ page, hasTouch }) => {
    test.skip(!hasTouch || viewport().width > TABLET_MAX, 'phone and tablet touch projects only');
    await openTitle(page);
    await page.getByRole('button', { name: 'Trailer' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const before = await box(dialog);
    const handle = await box(dialog.locator('.sheet-handle'));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    // A real pointer sequence (touch-action: none keeps the browser from panning instead).
    const cdp = await page.context().newCDPSession(page);
    const point = (type: 'touchStart' | 'touchMove' | 'touchEnd', dy: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y: y + dy }],
      });
    await point('touchStart', 0);
    for (let dy = 20; dy <= 60; dy += 20) await point('touchMove', dy);
    const during = await box(dialog);
    expect(during.y - before.y, 'the sheet follows the finger').toBeGreaterThanOrEqual(40);
    for (let dy = 80; dy <= 200; dy += 40) await point('touchMove', dy);
    await point('touchEnd', 0);
    await expect(dialog).toBeHidden();
  });

  test('opening a similar title keeps the route view transition', async ({ page }) => {
    await openTitle(page);
    const supported = await page.evaluate(() => 'startViewTransition' in document);
    test.skip(!supported, 'this browser has no view transitions');
    await page.evaluate(() => {
      const w = window as unknown as { __vt: string[] };
      w.__vt = [];
      const doc = document as Document & {
        startViewTransition: (cb: () => void | Promise<void>) => ViewTransition;
      };
      const orig = doc.startViewTransition.bind(doc);
      doc.startViewTransition = (cb) => {
        const t = orig(cb);
        t.ready.then(
          () => w.__vt.push('ready'),
          (e: unknown) => w.__vt.push(`rejected: ${(e as Error).message}`),
        );
        return t;
      };
    });
    const similar = page.locator('.title-similar .card-link').first();
    await similar.scrollIntoViewIfNeeded();
    const name = (await similar.getAttribute('aria-label'))!.replace(/ \(\d{4}\)$/, '');
    await similar.click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __vt: string[] }).__vt))
      .toEqual(['ready']);
  });
});

test.describe('reduced motion', () => {
  test.skip(
    () => test.info().project.use.reducedMotion !== 'reduce',
    'only for the *-reduced-motion projects',
  );

  test('hero and first row show their end frame with no running animations', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('section.hero');
    const firstRow = page.locator('section.row').first();
    await expect(hero).toBeVisible();
    await expect(firstRow).toBeVisible();
    await expect(hero).toHaveCSS('opacity', '1');
    await expect(firstRow).toHaveCSS('opacity', '1');
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    expect(running, 'running animations under prefers-reduced-motion').toBe(0);
  });
});
