#!/usr/bin/env node
// Rasterises the brand SVGs in public/ into the PNG fallbacks that browsers
// (and iOS home screens) still need. No npm dependencies: it drives a local
// headless Chromium binary directly via --screenshot.
//
//   node scripts/generate-icons.mjs
//   CHROME_BIN=/path/to/chrome node scripts/generate-icons.mjs
//
// Outputs (committed):
//   public/favicon-32.png         32x32, transparent, from public/favicon.svg
//   public/apple-touch-icon.png   180x180, full-bleed, from public/icons/icon.svg
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const targets = [
  { src: 'favicon.svg', out: 'favicon-32.png', size: 32 },
  { src: 'icons/icon.svg', out: 'apple-touch-icon.png', size: 180 },
];

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const dir of readdirSync(base).sort().reverse()) {
      for (const rel of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
        const p = join(base, dir, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chromium found. Set CHROME_BIN to a Chrome/Chromium binary.');
}

const chrome = findChrome();
const work = mkdtempSync(join(tmpdir(), 'lf-icons-'));

try {
  for (const { src, out, size } of targets) {
    const svg = readFileSync(join(pub, src), 'utf8');
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const html = join(work, `${size}.html`);
    writeFileSync(
      html,
      `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}` +
        `img{display:block;width:${size}px;height:${size}px}</style></head>` +
        `<body><img src="${dataUri}" alt=""></body></html>`,
    );
    const outPath = join(pub, out);
    execFileSync(
      chrome,
      [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        `--window-size=${size},${size}`,
        `--screenshot=${outPath}`,
        `file://${html}`,
      ],
      { stdio: 'pipe' },
    );
    console.log(`wrote public/${out} (${size}x${size})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
