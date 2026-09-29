import { useId } from 'react';
import '../../styles/brand.css';

export interface LogoMarkProps {
  /** Rendered width/height in px (or any CSS length). Defaults to 32. */
  size?: number | string;
  /** Accessible name announced by assistive tech. Ignored when decorative. */
  title?: string;
  /** Hide from assistive tech (e.g. when a visible wordmark sits next to it). */
  decorative?: boolean;
  className?: string;
}

/**
 * Glossy "LF" monogram: a translucent violet -> accent gradient tile on the
 * dark background colour, with a soft top highlight and a hairline border.
 * Colours come from the design tokens (with literal fallbacks so the mark
 * still renders outside the app shell). Glyphs are paths, not text, so the
 * mark never depends on a loaded font. Keep in sync with public/favicon.svg.
 */
export default function LogoMark({
  size = 32,
  title = 'Last Frame',
  decorative = false,
  className,
}: LogoMarkProps) {
  // useId() returns ":r0:"-style ids; colons are unsafe inside url(#...).
  const uid = `lf${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const tileId = `${uid}-tile`;
  const shineId = `${uid}-shine`;
  const titleId = `${uid}-title`;

  const a11y = decorative
    ? ({ 'aria-hidden': true, focusable: 'false' } as const)
    : ({ role: 'img', 'aria-labelledby': titleId } as const);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={['logo-mark', className].filter(Boolean).join(' ')}
      {...a11y}
    >
      {!decorative && <title id={titleId}>{title}</title>}
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-violet, #7c3aed)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-accent, #e50914)' }} />
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        style={{ fill: 'var(--color-bg, #0b0b12)' }}
      />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill={`url(#${tileId})`}
        fillOpacity="0.82"
      />
      <rect x="2" y="2" width="60" height="30" rx="15" fill={`url(#${shineId})`} />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="14.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      <path d="M16 18h6v22h8v6H16z M32 18h16v6H38v5h8v5h-8v12h-6z" fill="#f4f4f8" />
    </svg>
  );
}
