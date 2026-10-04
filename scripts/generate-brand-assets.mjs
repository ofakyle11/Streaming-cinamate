#!/usr/bin/env node
// Writes the downloadable brand kit SVGs in public/brand/ from the single
// source of truth in src/components/brand/marks.ts. No npm dependencies; it
// relies on Node's built-in TypeScript type stripping (Node 22.18+ / 23.6+).
//
//   node scripts/generate-brand-assets.mjs
//
// Outputs (committed), one trio per mark in the kit's default (Lumen) colourway:
//   public/brand/lf-<mark>-mark.svg     glyphs only, transparent background
//   public/brand/lf-<mark>-icon.svg     app-icon tile
//   public/brand/lf-<mark>-lockup.svg   mark + wordmark
// The app's own icons (favicon.svg, mask-icon.svg, icons/icon.svg, logo.svg)
// are the Lumen mark and are not generated here.
//
// src/components/brand/marks.test.ts fails when these files drift from marks.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKS, assetFiles, lockupSvg, markSvg } from '../src/components/brand/marks.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const out = join(pub, 'brand');
mkdirSync(out, { recursive: true });

for (const { id, name } of MARKS) {
  const files = assetFiles(id);
  const title = `Lastframe.tv ${name} mark`;
  writeFileSync(join(out, files.mark), markSvg({ mark: id, variant: 'bare', title }));
  writeFileSync(join(out, files.icon), markSvg({ mark: id, variant: 'tile', size: 512, title }));
  writeFileSync(join(out, files.lockup), lockupSvg({ mark: id }));
  console.log(`wrote public/brand/${files.mark}, ${files.icon}, ${files.lockup}`);
}
