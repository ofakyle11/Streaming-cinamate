import { useId } from 'react';
import {
  DEFAULT_COLOURWAY,
  LIGHT,
  NIGHT,
  getColourway,
  getMark,
  rr,
  type ColourwayId,
  type MarkId,
  type MarkVariant,
} from './marks';

export interface BrandMarkProps {
  mark: MarkId;
  colourway?: ColourwayId;
  variant?: MarkVariant;
  /** Rendered width/height in px (or any CSS length). Defaults to 32. */
  size?: number | string;
  /** Accessible name. Ignored when decorative. */
  title?: string;
  /** Hide from assistive tech (e.g. next to a visible wordmark). */
  decorative?: boolean;
  className?: string;
}

/**
 * One of the four proposed brand marks, drawn from the layer data in marks.ts.
 * Mirrors markSvg() layer for layer, but with per-instance gradient ids so
 * many marks can share a page.
 */
export default function BrandMark({
  mark,
  colourway = DEFAULT_COLOURWAY,
  variant = 'bare',
  size = 32,
  title,
  decorative = false,
  className,
}: BrandMarkProps) {
  const def = getMark(mark);
  const cw = getColourway(colourway);
  const uid = `bm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const gradId = `${uid}-grad`;
  const shineId = `${uid}-shine`;
  const titleId = `${uid}-title`;
  const name = title ?? `Last Frame ${def.name} mark`;

  const onGradientTile = variant === 'tile-gradient';
  const glyph = onGradientTile ? LIGHT : `url(#${gradId})`;

  const a11y = decorative
    ? ({ 'aria-hidden': true, focusable: 'false' } as const)
    : ({ role: 'img', 'aria-labelledby': titleId } as const);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={['brand-mark', `brand-mark--${variant}`, className].filter(Boolean).join(' ')}
      data-mark={mark}
      {...a11y}
    >
      {!decorative && <title id={titleId}>{name}</title>}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          {cw.stops.map((color, i) => (
            <stop
              key={color + i}
              offset={cw.stops.length === 1 ? 0 : i / (cw.stops.length - 1)}
              stopColor={color}
            />
          ))}
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {variant !== 'bare' && (
        <>
          <path d={rr(2, 2, 60, 60, 15)} fill={NIGHT} />
          {onGradientTile && (
            <path d={rr(2, 2, 60, 60, 15)} fill={`url(#${gradId})`} fillOpacity="0.82" />
          )}
          <path d={rr(2, 2, 60, 30, 15)} fill={`url(#${shineId})`} />
          <path
            d={rr(2.5, 2.5, 59, 59, 14.5)}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.28"
            strokeWidth="1"
          />
        </>
      )}
      {def.layers.fill.map((d) => (
        <path key={d} d={d} fill={glyph} />
      ))}
      {def.layers.stroke.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={glyph}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {def.layers.faint.map((d) => (
        <path key={d} d={d} fill={LIGHT} fillOpacity="0.35" />
      ))}
      {def.layers.faintStroke.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={LIGHT}
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
      {def.layers.light.map((d) => (
        <path key={d} d={d} fill={LIGHT} />
      ))}
    </svg>
  );
}
