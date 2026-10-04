import { describe, expect, it } from 'vitest';
import monogramMark from '../../../public/brand/lf-monogram-mark.svg?raw';
import monogramIcon from '../../../public/brand/lf-monogram-icon.svg?raw';
import monogramLockup from '../../../public/brand/lf-monogram-lockup.svg?raw';
import frameMark from '../../../public/brand/lf-frame-mark.svg?raw';
import frameIcon from '../../../public/brand/lf-frame-icon.svg?raw';
import frameLockup from '../../../public/brand/lf-frame-lockup.svg?raw';
import stripMark from '../../../public/brand/lf-strip-mark.svg?raw';
import stripIcon from '../../../public/brand/lf-strip-icon.svg?raw';
import stripLockup from '../../../public/brand/lf-strip-lockup.svg?raw';
import countdownMark from '../../../public/brand/lf-countdown-mark.svg?raw';
import countdownIcon from '../../../public/brand/lf-countdown-icon.svg?raw';
import countdownLockup from '../../../public/brand/lf-countdown-lockup.svg?raw';
import {
  COLOURWAYS,
  MARKS,
  appIconSvg,
  assetFiles,
  circle,
  isColourwayId,
  isMarkId,
  lockupSvg,
  markSvg,
  monoSvg,
  rr,
  type MarkId,
} from './marks';

/** The committed files, keyed like assetFiles() so the sync test is exhaustive. */
const COMMITTED: Record<MarkId, { mark: string; icon: string; lockup: string }> = {
  monogram: { mark: monogramMark, icon: monogramIcon, lockup: monogramLockup },
  frame: { mark: frameMark, icon: frameIcon, lockup: frameLockup },
  strip: { mark: stripMark, icon: stripIcon, lockup: stripLockup },
  countdown: { mark: countdownMark, icon: countdownIcon, lockup: countdownLockup },
};

describe('marks', () => {
  it('defines four marks and five colourways with unique ids', () => {
    expect(MARKS).toHaveLength(4);
    expect(COLOURWAYS).toHaveLength(5);
    expect(new Set(MARKS.map((m) => m.id)).size).toBe(4);
    expect(new Set(COLOURWAYS.map((c) => c.id)).size).toBe(5);
    expect(MARKS.map((m) => m.index)).toEqual(['01', '02', '03', '04']);
  });

  it('every mark draws something in the brand colour', () => {
    for (const m of MARKS) {
      expect(m.layers.fill.length + m.layers.stroke.length).toBeGreaterThan(0);
    }
  });

  it('type guards accept known ids only', () => {
    expect(isMarkId('strip')).toBe(true);
    expect(isMarkId('nope')).toBe(false);
    expect(isMarkId(null)).toBe(false);
    expect(isColourwayId('ember')).toBe(true);
    expect(isColourwayId('')).toBe(false);
  });

  it('rounded rect and circle helpers emit closed paths', () => {
    expect(rr(0, 0, 10, 10, 2)).toMatch(/^M2 0h6a2 2 0 0 1 2 2v6.*z$/);
    expect(circle(32, 32, 4)).toBe('M28 32a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z');
  });

  it('markSvg builds a self-contained SVG with the chosen colourway', () => {
    const svg = markSvg({ mark: 'countdown', colourway: 'lagoon', title: 'Countdown' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(
      true,
    );
    expect(svg).toContain('role="img"');
    expect(svg).toContain('<title id="lf-title">Countdown</title>');
    expect(svg).toContain('stop-color="#06b6d4"');
    expect(svg).toContain('stop-color="#3b82f6"');
    expect(svg).not.toContain('#7c3aed');
  });

  it('a decorative markSvg is hidden and a tile variant paints the night background', () => {
    const bare = markSvg({ mark: 'frame' });
    expect(bare).toContain('aria-hidden="true"');
    expect(bare).not.toContain('#0b0b12');
    const tile = markSvg({ mark: 'frame', variant: 'tile', size: 512 });
    expect(tile).toContain('width="512" height="512"');
    expect(tile).toContain('fill="#0b0b12"');
    // Gradient tiles swap the glyphs to the light colour.
    const gradientTile = markSvg({ mark: 'monogram', variant: 'tile-gradient' });
    expect(gradientTile).toContain('fill-opacity="0.82"');
    expect(gradientTile).toContain(
      'M16 18h6v22h8v6H16z M32 18h16v6H38v5h8v5h-8v12h-6z" fill="#f4f4f8"',
    );
  });

  it('lockupSvg carries the wordmark as text next to the mark', () => {
    const svg = lockupSvg({ mark: 'strip' });
    expect(svg).toContain('>LASTFRAME.TV</text>');
    expect(svg).toContain('<title id="lf-title">Lastframe.tv</title>');
    expect((svg.match(/<linearGradient/g) ?? []).length).toBe(1);
  });

  it('public/brand/*.svg match the generator (run scripts/generate-brand-assets.mjs)', () => {
    for (const { id, name } of MARKS) {
      expect(assetFiles(id)).toEqual({
        mark: `lf-${id}-mark.svg`,
        icon: `lf-${id}-icon.svg`,
        lockup: `lf-${id}-lockup.svg`,
      });
      const title = `Lastframe.tv ${name} mark`;
      expect(COMMITTED[id].mark).toBe(markSvg({ mark: id, variant: 'bare', title }));
      expect(COMMITTED[id].icon).toBe(markSvg({ mark: id, variant: 'tile', size: 512, title }));
      expect(COMMITTED[id].lockup).toBe(lockupSvg({ mark: id }));
    }
  });

  it('appIconSvg scales the glyphs into a 512 tile and monoSvg paints everything black', () => {
    const rounded = appIconSvg({ mark: 'strip', shape: 'rounded', title: 'Lastframe.tv' });
    expect(rounded).toContain('viewBox="0 0 512 512"');
    expect(rounded).toContain('translate(256 256) scale(6) translate(-32 -32)');
    expect(rounded).toContain('a112 112 0 0 1');
    const bleed = appIconSvg({ mark: 'strip', shape: 'bleed' });
    expect(bleed).toContain('<rect width="512" height="512" fill="#0b0b12"/>');
    expect(bleed).not.toContain('a112 112');
    const mono = monoSvg({ mark: 'strip' });
    expect(mono).not.toMatch(/url\(#|opacity|#f4f4f8/);
    expect(mono).toContain('fill="#000"');
    expect(mono).toContain('stroke="#000"');
    // Detail strokes are hairlines in the silhouette; the main strokes keep their weight.
    expect(mono).toContain('stroke-width="0.75"');
    expect(mono).not.toContain('stroke-width="1.5"');
    expect(monoSvg({ mark: 'countdown' })).toContain('stroke-width="4"');
  });
});
