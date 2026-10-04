#!/usr/bin/env node
// Regenerates public/sitemap.xml (and the Sitemap line in public/robots.txt)
// for the static routes of the SPA. No npm dependencies.
//
//   node scripts/generate-sitemap.mjs
//   SITE_ORIGIN=https://staging.lastframe.tv node scripts/generate-sitemap.mjs
//
// SITE_ORIGIN defaults to the placeholder https://lastframe.tv. Keep ROUTES in
// sync with the static (parameter-free) routes in src/app/router.tsx; dynamic
// routes such as /title/:type/:id and /genre/:id are not listed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/search', changefreq: 'weekly', priority: '0.8' },
  { path: '/my-list', changefreq: 'weekly', priority: '0.5' },
  { path: '/profiles', changefreq: 'monthly', priority: '0.3' },
  { path: '/account', changefreq: 'monthly', priority: '0.3' },
  { path: '/plans', changefreq: 'monthly', priority: '0.6' },
  { path: '/brand', changefreq: 'monthly', priority: '0.3' },
];

const origin = (process.env.SITE_ORIGIN || 'https://lastframe.tv').replace(/\/+$/, '');
const pub = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public');

const urls = ROUTES.map(
  (r) =>
    `  <url>\n    <loc>${origin}${r.path}</loc>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
).join('\n');

writeFileSync(
  join(pub, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

const robotsPath = join(pub, 'robots.txt');
const robots = readFileSync(robotsPath, 'utf8').replace(
  /^Sitemap:.*$/m,
  `Sitemap: ${origin}/sitemap.xml`,
);
writeFileSync(robotsPath, robots);

console.log(`Wrote sitemap.xml (${ROUTES.length} routes) for ${origin}`);
