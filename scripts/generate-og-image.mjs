#!/usr/bin/env node
// Renders the landing page share card public/og-landing.png (1200 x 630) with
// the project's Playwright Chromium. The card is plain HTML on the real Lumen
// tokens (src/styles/tokens.css) and the self-hosted fonts, so it never
// carries a literal colour of its own.
//
//   node scripts/generate-og-image.mjs
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/generate-og-image.mjs
//
// Output (committed): public/og-landing.png
import { chromium } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const styles = join(root, 'src', 'styles');
const ORIGIN = 'http://lastframe.local';
const OUT = join(pub, 'og-landing.png');

/** A preinstalled Chromium (sandbox), else Playwright's own resolution. */
function executablePath() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  for (const dir of readdirSync(base).sort().reverse()) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = join(base, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const TILES = [
  ['nebula', 91],
  ['lagoon', 84],
  ['dusk', 78],
  ['meadow', 88],
  ['gold', 73],
  ['aurora', 95],
];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/styles/fonts.css">
<link rel="stylesheet" href="/styles/tokens.css">
<style>
  html, body { margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: var(--font-body); }
  .card { position: relative; width: 1200px; height: 630px; overflow: hidden;
    background: var(--color-ink); color: var(--color-ink-fg); }
  .card::before { content: ''; position: absolute; inset: 0; background:
    radial-gradient(60% 70% at 85% 10%, color-mix(in srgb, var(--brand-lavender) 28%, transparent), transparent 60%),
    radial-gradient(40% 50% at 10% 100%, color-mix(in srgb, var(--color-sky) 18%, transparent), transparent 60%); }
  .copy { position: absolute; left: 72px; top: 72px; width: 620px; }
  .brand { display: flex; align-items: center; gap: 14px; font-family: var(--font-display);
    font-weight: 700; font-size: 28px; letter-spacing: 1px; }
  .brand img { width: 44px; height: 44px; border-radius: 12px; }
  .brand .tv { color: var(--color-ink-accent); }
  .eyebrow { margin: 56px 0 0; font-family: var(--font-mono); font-size: 15px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--color-ink-accent); }
  h1 { margin: 16px 0 0; font-family: var(--font-display); font-weight: 700; font-size: 66px;
    line-height: 1.02; letter-spacing: -0.02em; }
  h1 em { font-style: normal; background: var(--brand-gradient); -webkit-background-clip: text;
    background-clip: text; color: transparent; }
  p { margin: 24px 0 0; font-size: 24px; line-height: 1.45; color: var(--color-ink-fg-soft); }
  .wall { position: absolute; right: -20px; top: 70px; display: grid; grid-template-columns: repeat(3, 150px);
    gap: 16px; transform: rotate(-6deg); }
  .tile { position: relative; height: 225px; border-radius: 18px;
    box-shadow: 0 20px 50px color-mix(in srgb, var(--color-ink) 45%, transparent); }
  .tile:nth-child(3n + 2) { translate: 0 -28px; }
  .tile::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
    background: linear-gradient(180deg, transparent 45%, var(--color-ink-scrim)); }
  .fit { position: absolute; left: 12px; top: 12px; z-index: 1; padding: 4px 10px; border-radius: 999px;
    font-family: var(--font-mono); font-size: 12px; color: var(--color-ink-fg);
    background: color-mix(in srgb, var(--brand-lavender) 35%, transparent); }
</style></head>
<body><div class="card">
  <div class="copy">
    <div class="brand"><img src="/icons/icon.svg" alt=""><span>Lastframe<span class="tv">.tv</span></span></div>
    <p class="eyebrow">Film &amp; TV discovery</p>
    <h1>Know where it streams <em>before you go looking.</em></h1>
    <p>Where to watch tonight, a fit score for your taste, and one list on every device.</p>
  </div>
  <div class="wall">
    ${TILES.map(([g, fit]) => `<div class="tile" style="background:var(--avatar-${g})"><span class="fit">Fit ${fit}</span></div>`).join('')}
  </div>
</div></body></html>`;

const TYPES = {
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const browser = await chromium.launch({ executablePath: executablePath() });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/og.html') return route.fulfill({ contentType: 'text/html', body: html });
    const file = path.startsWith('/styles/')
      ? join(styles, path.slice('/styles/'.length))
      : join(pub, path);
    if (!file.startsWith(pub) && !file.startsWith(styles)) return route.fulfill({ status: 403 });
    if (!existsSync(file)) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: TYPES[extname(file)] ?? 'application/octet-stream',
      body: readFileSync(file),
    });
  });
  await page.goto(`${ORIGIN}/og.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: 'png' });
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
}
