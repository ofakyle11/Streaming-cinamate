#!/usr/bin/env node
// Writes the downloadable brand kit SVGs in public/brand/ from the single
// source of truth in src/components/brand/marks.ts. No npm dependencies; it
// relies on Node's built-in TypeScript type stripping (Node 22.18+ / 23.6+).
//
//   node scripts/generate-brand-assets.mjs
//
// Outputs (committed), one trio per mark in the Aurora colourway:
//   public/brand/lf-<mark>-mark.svg     glyphs only, transparent background
//   public/brand/lf-<mark>-icon.svg     app-icon tile
//   public/brand/lf-<mark>-lockup.svg   mark + wordmark
// plus the app's own icons, drawn from ACTIVE_BRAND:
//   public/favicon.svg                  64px tile (browser tab)
//   public/mask-icon.svg                black silhouette (Safari pinned tab)
//   public/icons/icon.svg               512px full-bleed maskable icon
//   public/logo.svg                     512px rounded tile; PWA icon source
// Run scripts/generate-icons.mjs afterwards to refresh the PNG fallbacks.
//
// src/components/brand/marks.test.ts fails when these files drift from marks.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIVE_BRAND,
  MARKS,
  appIconSvg,
  assetFiles,
  lockupSvg,
  markSvg,
  monoSvg,
} from '../src/components/brand/marks.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const out = join(pub, 'brand');
mkdirSync(out, { recursive: true });
mkdirSync(join(pub, 'icons'), { recursive: true });

for (const { id, name } of MARKS) {
  const files = assetFiles(id);
  const title = `Last Frame ${name} mark`;
  writeFileSync(join(out, files.mark), markSvg({ mark: id, variant: 'bare', title }));
  writeFileSync(join(out, files.icon), markSvg({ mark: id, variant: 'tile', size: 512, title }));
  writeFileSync(join(out, files.lockup), lockupSvg({ mark: id }));
  console.log(`wrote public/brand/${files.mark}, ${files.icon}, ${files.lockup}`);
}

const { mark, colourway } = ACTIVE_BRAND;
const title = 'Last Frame';
writeFileSync(
  join(pub, 'favicon.svg'),
  markSvg({ mark, colourway, variant: 'tile', size: 64, title }),
);
writeFileSync(join(pub, 'mask-icon.svg'), monoSvg({ mark }));
writeFileSync(
  join(pub, 'icons', 'icon.svg'),
  appIconSvg({ mark, colourway, shape: 'bleed', title }),
);
writeFileSync(join(pub, 'logo.svg'), appIconSvg({ mark, colourway, shape: 'rounded', title }));
console.log(
  `wrote favicon.svg, mask-icon.svg, icons/icon.svg, logo.svg for ${mark} / ${colourway}`,
);
