/**
 * Brand kit source of truth: the four proposed Last Frame marks and the four
 * colourways, as plain path data on a 64x64 grid.
 *
 * Everything that draws a mark reads from here so the pieces cannot drift:
 *   - BrandMark.tsx renders the same layers as JSX (token colours, unique ids)
 *   - scripts/generate-brand-assets.mjs writes public/brand/*.svg via markSvg()
 *   - marks.test.ts checks the committed SVG files still match markSvg()
 *
 * This module is imported by Node (type-stripped) as well as by Vite, so it
 * must stay dependency-free and use only erasable TypeScript syntax.
 */

export type MarkId = 'monogram' | 'frame' | 'strip' | 'countdown';
export type ColourwayId = 'aurora' | 'lagoon' | 'dusk' | 'ember';

/** How a mark sits on its background. */
export type MarkVariant =
  /** Glyphs only, on a transparent background. */
  | 'bare'
  /** App-icon tile: night background, gradient glyphs. */
  | 'tile'
  /** App-icon tile: gradient background, light glyphs (the current favicon look). */
  | 'tile-gradient';

export interface MarkLayers {
  /** Filled with the brand gradient (or light on a gradient tile). */
  fill: string[];
  /** Stroked (width 4) with the brand gradient (or light on a gradient tile). */
  stroke: string[];
  /** Always filled with the light text colour. */
  light: string[];
  /** Filled with the light text colour at 35% opacity. */
  faint: string[];
  /** Stroked (width 1.5) with the light text colour at 35% opacity. */
  faintStroke: string[];
}

export interface MarkDef {
  id: MarkId;
  /** Two-digit index shown in the kit ("01"). */
  index: string;
  name: string;
  /** One line on what the mark says. */
  idea: string;
  /** A short rationale for review. */
  rationale: string;
  layers: MarkLayers;
}

export interface ColourwayDef {
  id: ColourwayId;
  name: string;
  /** Gradient stops, top-left to bottom-right. */
  stops: string[];
  /** Where the colours come from. */
  note: string;
}

/** Light (text) colour used for glyphs on gradient tiles and for highlights. */
export const LIGHT = '#f4f4f8';
/** Night background used for tiles. */
export const NIGHT = '#0b0b12';

/** Rounded rectangle as a path (clockwise from the top-left corner). */
export function rr(x: number, y: number, w: number, h: number, r: number): string {
  const n = (v: number) => +v.toFixed(2);
  return (
    `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${n(h - 2 * r)}` +
    `a${r} ${r} 0 0 1 -${r} ${r}h-${n(w - 2 * r)}a${r} ${r} 0 0 1 -${r} -${r}v-${n(h - 2 * r)}` +
    `a${r} ${r} 0 0 1 ${r} -${r}z`
  );
}

/** Circle as a path (two half arcs). */
export function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0z`;
}

const noLayers: MarkLayers = { fill: [], stroke: [], light: [], faint: [], faintStroke: [] };
const layers = (partial: Partial<MarkLayers>): MarkLayers => ({ ...noLayers, ...partial });

export const MARKS: readonly MarkDef[] = [
  {
    id: 'monogram',
    index: '01',
    name: 'Monogram',
    idea: 'The initials, cut square. The original mark.',
    rationale:
      'Reads at 16px, works as a favicon and an avatar, and carries no metaphor to date. The safe choice.',
    // The original "LF" glyphs the app launched with, unchanged.
    layers: layers({ fill: ['M16 18h6v22h8v6H16z M32 18h16v6H38v5h8v5h-8v12h-6z'] }),
  },
  {
    id: 'frame',
    index: '02',
    name: 'Frame',
    idea: 'A single film frame with its sprocket holes, and play inside it.',
    rationale:
      'The most literal: a frame you can press. Already the shape of the PWA icon, so it costs nothing to adopt.',
    layers: layers({
      stroke: [rr(12, 17, 40, 30, 6)],
      light: ['M27 25L39 32L27 39z'],
      faint: [
        rr(16, 21, 3.5, 3.5, 1),
        rr(16, 30.25, 3.5, 3.5, 1),
        rr(16, 39.5, 3.5, 3.5, 1),
        rr(44.5, 21, 3.5, 3.5, 1),
        rr(44.5, 30.25, 3.5, 3.5, 1),
        rr(44.5, 39.5, 3.5, 3.5, 1),
      ],
    }),
  },
  {
    id: 'strip',
    index: '03',
    name: 'Strip',
    idea: 'Four frames of film. Only the last one is lit.',
    rationale:
      'Says the name without a letter: the last frame is the one that matters. Needs 24px or more to read.',
    layers: layers({
      fill: [rr(45, 24, 10, 16, 2)],
      light: ['M48 29L53 32L48 35z'],
      faintStroke: [rr(9, 24, 10, 16, 2), rr(21, 24, 10, 16, 2), rr(33, 24, 10, 16, 2)],
      faint: [
        rr(12.5, 18, 3, 3, 0.75),
        rr(24.5, 18, 3, 3, 0.75),
        rr(36.5, 18, 3, 3, 0.75),
        rr(48.5, 18, 3, 3, 0.75),
        rr(12.5, 43, 3, 3, 0.75),
        rr(24.5, 43, 3, 3, 0.75),
        rr(36.5, 43, 3, 3, 0.75),
        rr(48.5, 43, 3, 3, 0.75),
      ],
    }),
  },
  {
    id: 'countdown',
    index: '04',
    name: 'Countdown',
    idea: 'The film leader: a ring, a crosshair and a sweep about to hit zero.',
    rationale:
      'Anticipation before the picture starts. Round, so it sits well in avatars and the play button. The boldest of the four.',
    layers: layers({
      stroke: [circle(32, 32, 22)],
      fill: ['M32 32L32 12A20 20 0 0 1 49.32 42z'],
      faintStroke: ['M32 12v6M32 46v6M12 32h6M46 32h6'],
      light: [circle(32, 32, 3)],
    }),
  },
];

export const COLOURWAYS: readonly ColourwayDef[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    stops: ['#7c3aed', '#e50914'],
    note: 'Violet into signal red. The current brand gradient (--color-violet, --color-accent).',
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    stops: ['#06b6d4', '#3b82f6'],
    note: 'Cyan into blue, from the profile avatar set (--avatar-lagoon).',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    stops: ['#7c3aed', '#ec4899'],
    note: 'Violet into pink, from the profile avatar set (--avatar-dusk).',
  },
  {
    id: 'ember',
    name: 'Ember',
    stops: ['#f97316', '#e50914'],
    note: 'Orange into signal red, from the profile avatar set (--avatar-ember).',
  },
];

/**
 * The direction the app ships with. Change it here, then run
 * `node scripts/generate-brand-assets.mjs && node scripts/generate-icons.mjs`
 * to refresh the static icons; the Navbar and the kit pick it up on their own.
 */
export const ACTIVE_BRAND: { readonly mark: MarkId; readonly colourway: ColourwayId } = {
  mark: 'countdown',
  colourway: 'aurora',
};

export const DEFAULT_MARK: MarkId = ACTIVE_BRAND.mark;
export const DEFAULT_COLOURWAY: ColourwayId = ACTIVE_BRAND.colourway;

export function getMark(id: MarkId): MarkDef {
  return MARKS.find((m) => m.id === id) ?? MARKS[0];
}

export function getColourway(id: ColourwayId): ColourwayDef {
  return COLOURWAYS.find((c) => c.id === id) ?? COLOURWAYS[0];
}

export function isMarkId(value: string | null | undefined): value is MarkId {
  return MARKS.some((m) => m.id === value);
}

export function isColourwayId(value: string | null | undefined): value is ColourwayId {
  return COLOURWAYS.some((c) => c.id === value);
}

/** Gradient stops as SVG <stop> elements, evenly spaced. */
export function gradientStops(stops: readonly string[]): string {
  return stops
    .map((color, i) => {
      const offset = stops.length === 1 ? 0 : i / (stops.length - 1);
      return `<stop offset="${+offset.toFixed(2)}" stop-color="${color}"/>`;
    })
    .join('');
}

export interface MarkSvgOptions {
  mark: MarkId;
  colourway?: ColourwayId;
  variant?: MarkVariant;
  /** Rendered width/height attribute; omit for a size-less SVG. */
  size?: number;
  /** <title> text; omit for a decorative SVG. */
  title?: string;
}

const SHINE_GRADIENT =
  `<linearGradient id="lf-shine" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#fff" stop-opacity="0.38"/>` +
  `<stop offset="0.5" stop-color="#fff" stop-opacity="0.06"/>` +
  `<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

function gradientDef(stops: readonly string[]): string {
  return `<linearGradient id="lf-grad" x1="0" y1="0" x2="1" y2="1">${gradientStops(stops)}</linearGradient>`;
}

function pathList(ds: string[], attrs: string): string {
  return ds.map((d) => `<path d="${d}" ${attrs}/>`).join('');
}

/**
 * The glyph layers of a mark on the 64-grid. `glyph` paints the fill/stroke
 * layers; `light` paints the light layers (with the usual 35% faint variants).
 */
function layerMarkup(def: MarkDef, glyph: string, light: string, faintOpacity = 0.35): string {
  const faint = faintOpacity === 1 ? '' : ` fill-opacity="${faintOpacity}"`;
  const faintStroke = faintOpacity === 1 ? '' : ` stroke-opacity="${faintOpacity}"`;
  return (
    pathList(def.layers.fill, `fill="${glyph}"`) +
    pathList(
      def.layers.stroke,
      `fill="none" stroke="${glyph}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`,
    ) +
    pathList(def.layers.faint, `fill="${light}"${faint}`) +
    pathList(
      def.layers.faintStroke,
      `fill="none" stroke="${light}"${faintStroke} stroke-width="1.5" stroke-linecap="round"`,
    ) +
    pathList(def.layers.light, `fill="${light}"`)
  );
}

/** Night tile background with its shine and hairline, on the 64-grid. */
function tileMarkup(gradientFill: boolean): string {
  return (
    `<path d="${rr(2, 2, 60, 60, 15)}" fill="${NIGHT}"/>` +
    (gradientFill
      ? `<path d="${rr(2, 2, 60, 60, 15)}" fill="url(#lf-grad)" fill-opacity="0.82"/>`
      : '') +
    `<path d="${rr(2, 2, 60, 30, 15)}" fill="url(#lf-shine)"/>` +
    `<path d="${rr(2.5, 2.5, 59, 59, 14.5)}" fill="none" stroke="#fff" stroke-opacity="0.28"/>`
  );
}

function svgOpen(viewBox: string, size: number | undefined, title: string | undefined): string {
  const sizeAttr = size ? ` width="${size}" height="${size}"` : '';
  const a11y = title ? ` role="img" aria-labelledby="lf-title"` : ` aria-hidden="true"`;
  const titleEl = title ? `<title id="lf-title">${title}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${sizeAttr}${a11y}>${titleEl}`;
}

/**
 * Standalone SVG markup for a mark (used for the downloadable files). The
 * JSX in BrandMark.tsx mirrors this layer for layer.
 */
export function markSvg({
  mark,
  colourway = DEFAULT_COLOURWAY,
  variant = 'bare',
  size,
  title,
}: MarkSvgOptions): string {
  const def = getMark(mark);
  const cw = getColourway(colourway);
  const onGradientTile = variant === 'tile-gradient';
  const glyph = onGradientTile ? LIGHT : 'url(#lf-grad)';
  return (
    svgOpen('0 0 64 64', size, title) +
    `<defs>${gradientDef(cw.stops)}${SHINE_GRADIENT}</defs>` +
    (variant === 'bare' ? '' : tileMarkup(onGradientTile)) +
    layerMarkup(def, glyph, LIGHT) +
    `</svg>\n`
  );
}

export interface AppIconSvgOptions {
  mark: MarkId;
  colourway?: ColourwayId;
  /**
   * `rounded`: a 512px rounded tile (PWA source, logo.svg).
   * `bleed`: full-bleed square for maskable icons; the glyphs stay inside the
   * central 80% safe zone.
   */
  shape: 'rounded' | 'bleed';
  title?: string;
}

/** 512px app-icon artwork: night background, the glyphs scaled x6 and centred. */
export function appIconSvg({
  mark,
  colourway = DEFAULT_COLOURWAY,
  shape,
  title,
}: AppIconSvgOptions): string {
  const def = getMark(mark);
  const cw = getColourway(colourway);
  const background =
    shape === 'rounded'
      ? `<path d="${rr(0, 0, 512, 512, 112)}" fill="${NIGHT}"/>` +
        `<path d="${rr(0, 0, 512, 256, 112)}" fill="url(#lf-shine)"/>` +
        `<path d="${rr(4, 4, 504, 504, 108)}" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="8"/>`
      : `<rect width="512" height="512" fill="${NIGHT}"/>` +
        `<rect width="512" height="256" fill="url(#lf-shine)"/>`;
  return (
    svgOpen('0 0 512 512', 512, title) +
    `<defs>${gradientDef(cw.stops)}${SHINE_GRADIENT}</defs>` +
    background +
    `<g transform="translate(256 256) scale(6) translate(-32 -32)">` +
    layerMarkup(def, 'url(#lf-grad)', LIGHT) +
    `</g></svg>\n`
  );
}

/** Single-colour silhouette (Safari pinned tab `mask-icon`): every layer in black. */
export function monoSvg({ mark, title }: Pick<MarkSvgOptions, 'mark' | 'title'>): string {
  const def = getMark(mark);
  return svgOpen('0 0 64 64', undefined, title) + layerMarkup(def, '#000', '#000', 1) + `</svg>\n`;
}

/** Wordmark text and the letter-spacing/weight the kit proposes for it. */
export const WORDMARK = 'LAST FRAME';
export const WORDMARK_FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Standalone horizontal lockup: mark on the left, wordmark on the right.
 * The wordmark is live text, so it takes the viewer's Inter/system font.
 */
export function lockupSvg({
  mark,
  colourway = DEFAULT_COLOURWAY,
  title = 'Last Frame',
}: Pick<MarkSvgOptions, 'mark' | 'colourway' | 'title'>): string {
  const inner = markSvg({ mark, colourway, variant: 'bare' })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<defs>.*<\/defs>/, '');
  const cw = getColourway(colourway);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" role="img" aria-labelledby="lf-title">` +
    `<title id="lf-title">${title}</title>` +
    `<defs><linearGradient id="lf-grad" x1="0" y1="0" x2="1" y2="1">${gradientStops(cw.stops)}</linearGradient></defs>` +
    `<g>${inner}</g>` +
    `<text x="76" y="42" fill="${LIGHT}" font-family="${WORDMARK_FONT}" font-size="24" font-weight="900" letter-spacing="3.5">${WORDMARK}</text>` +
    `</svg>\n`
  );
}

/** File names under public/brand/ for a mark. */
export function assetFiles(mark: MarkId): { mark: string; icon: string; lockup: string } {
  return {
    mark: `lf-${mark}-mark.svg`,
    icon: `lf-${mark}-icon.svg`,
    lockup: `lf-${mark}-lockup.svg`,
  };
}
