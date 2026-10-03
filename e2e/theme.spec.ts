import { expect, test } from '@playwright/test';

const INK = 'rgb(20, 17, 38)';
const CLOUD = 'rgb(246, 245, 255)';

test.describe('theme', () => {
  test('light by default, following the device', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    await expect(page.locator('body')).toHaveCSS('background-color', CLOUD);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveCSS('background-color', INK);
  });

  test('theme-init.js runs before the app bundle and is allowed by the CSP shape', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text();
    const init = html.indexOf('src="/theme-init.js"');
    const firstModule = html.indexOf('<script type="module"');
    const firstStylesheet = html.indexOf('rel="stylesheet"');
    expect(init).toBeGreaterThan(-1);
    expect(init).toBeLessThan(firstModule);
    if (firstStylesheet !== -1) expect(init).toBeLessThan(firstStylesheet);
  });

  test('the choice survives a reload with no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const control = page.getByRole('radiogroup', { name: 'Theme' }).first();
    await control.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', INK);
    expect(await page.evaluate(() => localStorage.getItem('lf.theme'))).toBe('dark');

    // Watch <html> from document start: the attribute must appear while the document is
    // still parsing and before any stylesheet exists, so the first paint is already dark.
    await page.addInitScript(() => {
      const w = window as unknown as {
        __theme: { value: string | null; readyState: string; sheets: number }[];
      };
      w.__theme = [];
      // <html> does not exist yet at document start, so observe the document subtree.
      new MutationObserver((records) => {
        for (const r of records) {
          if (r.target !== document.documentElement) continue;
          w.__theme.push({
            value: document.documentElement.getAttribute('data-theme'),
            readyState: document.readyState,
            sheets: document.querySelectorAll('link[rel="stylesheet"]').length,
          });
        }
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const first = await page.evaluate(
      () =>
        (
          window as unknown as {
            __theme: { value: string | null; readyState: string; sheets: number }[];
          }
        ).__theme[0],
    );
    expect(first).toEqual({ value: 'dark', readyState: 'loading', sheets: 0 });
    const metas = await page.$$eval('meta[name="theme-color"]', (els) =>
      els.map((m) => m.getAttribute('content')),
    );
    expect(metas).toEqual(['#141126', '#141126']);
  });

  test('keyboard: arrows move through System, Light, Dark and the change is announced', async ({
    page,
  }) => {
    await page.goto('/');
    const control = page.getByRole('radiogroup', { name: 'Theme' }).first();
    await control.getByRole('radio', { name: 'System' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(control.getByRole('radio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(control.getByRole('radio', { name: 'Light' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(control.getByRole('radio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('status').filter({ hasText: 'Dark theme on' })).toHaveCount(1);
  });

  test('on a phone the control lives in the menu sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('radiogroup', { name: 'Theme' }).first()).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    const inMenu = page.locator('#primary-nav-links').getByRole('radiogroup', { name: 'Theme' });
    await expect(inMenu).toBeVisible();
    await inMenu.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(inMenu).toBeVisible();
  });
});
