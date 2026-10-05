import { expect, test, type Page } from '@playwright/test';

const TITLE = 'Neon Drift';

async function openTitle(page: Page, name = TITLE) {
  await page.goto(`/search?q=${encodeURIComponent(name)}`);
  const results = page.getByRole('list', { name: 'Search results' });
  await results
    .getByRole('link', { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('home renders catalogue rows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  const rows = page.locator('section.row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(1);
  await expect(rows.first().locator('a[href^="/title/"]').first()).toBeVisible();
});

test('search finds a mock title', async ({ page }) => {
  await page.goto('/search');
  await page.getByPlaceholder('Search films and series').fill('Neon');
  await expect(
    page
      .getByRole('list', { name: 'Search results' })
      .getByRole('link', { name: /Neon Drift/ })
      .first(),
  ).toBeVisible();
});

test('opens a title page', async ({ page }) => {
  await openTitle(page);
  await expect(page).toHaveURL(/\/title\/(movie|tv)\/\d+/);
  await expect(
    page.locator('article.title-panel').getByRole('button', { name: 'My List', exact: true }),
  ).toBeVisible();
});

test('add to My List persists after reload', async ({ page }) => {
  await openTitle(page);
  const toggle = page
    .locator('article.title-panel')
    .getByRole('button', { name: 'My List', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page.locator('article.title-panel').getByRole('button', { name: 'My List', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/my-list');
  await expect(
    page
      .locator('main')
      .getByRole('link', { name: new RegExp(TITLE) })
      .first(),
  ).toBeVisible();
});

test('switching profile changes My List', async ({ page }) => {
  await openTitle(page);
  await page
    .locator('article.title-panel')
    .getByRole('button', { name: 'My List', exact: true })
    .click();
  await page.goto('/my-list');
  await expect(
    page
      .locator('main')
      .getByRole('link', { name: new RegExp(TITLE) })
      .first(),
  ).toBeVisible();

  // Create a second profile and switch to it.
  await page.goto('/profiles');
  await page.getByRole('button', { name: 'Add profile' }).click();
  await page.getByLabel('Name').fill('Guest');
  await page.getByRole('dialog').getByRole('button', { name: 'Add profile' }).click();
  await page.goto('/');
  await page.getByRole('button', { name: /Switch profile/ }).click();
  await page.getByRole('menuitemradio', { name: /Guest/ }).click();
  await expect(page.getByRole('button', { name: /Profile: Guest/ })).toBeVisible();

  await page.goto('/my-list');
  await expect(page.locator('main').getByRole('link', { name: new RegExp(TITLE) })).toHaveCount(0);
});

test('plans page shows mock checkout', async ({ page }) => {
  await page.goto('/plans');
  await expect(page.getByRole('heading', { name: 'Choose your plan' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Demo mode');
  await page.getByRole('button', { name: /^Start / }).click();
  await expect(page.getByText(/You're on /).first()).toBeVisible();
});

test('sign-in flow (mock mode): returns to the page you came from', async ({ page }) => {
  await page.goto('/my-list');
  await page.getByRole('button', { name: /switch profile/i }).click();
  await page.getByRole('menuitem', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fmy-list/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Lastframe.tv' })).toBeVisible();
  await expect(page.getByRole('button', { name: /google/i })).toHaveCount(0);
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page).toHaveURL(/\/my-list$/);
  await page.getByRole('button', { name: /switch profile/i }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByText(/signed out/i)).toBeVisible();
});

test('an expired link explains itself on /sign-in', async ({ page }) => {
  await page.goto('/auth/callback#error=access_denied&error_code=otp_expired');
  await expect(page).toHaveURL(/\/sign-in\?error=expired$/);
  await expect(page.locator('.auth-error')).toContainText('That link has expired');
  await expect(page.getByRole('button', { name: 'Send a new link' })).toBeVisible();
});
