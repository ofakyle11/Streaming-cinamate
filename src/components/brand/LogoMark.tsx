import { useId } from 'react';
import '../../styles/brand.css';

export type LogoMarkVariant = 'header' | 'hero';
export type LogoMarkAnimate = 'once' | 'hover' | 'none';

export interface LogoMarkProps {
  /** Rendered width/height in px (or any CSS length). Defaults to 32. */
  size?: number | string;
  /** Accessible name announced by assistive tech. Ignored when decorative. */
  title?: string;
  /** Hide from assistive tech (e.g. when a visible wordmark sits next to it). */
  decorative?: boolean;
  className?: string;
  /**
   * `header` (default, 24 to 30px): the lens disc plus a soft shadow. The band
   * only sweeps on hover and there is no halo, because both turn to mush at
   * that size. `hero` (32px and up): all three light layers, with the
   * lights-down gradient pair because the hero sits on an Ink screen.
   */
  variant?: LogoMarkVariant;
  /**
   * `once` (default): play the load choreography on mount, then answer hover.
   * `hover`: skip the load sequence, still answer hover. `none`: a still mark.
   * Under `prefers-reduced-motion: reduce` every value renders the end frame.
   */
  animate?: LogoMarkAnimate;
}

/**
 * The Lumen mark: a squircle with a disc of light cut from its top-right
 * corner. The squircle never moves; three layers of light do the work and all
 * of them are CSS keyframes on transform and opacity in brand.css:
 *
 *  - the lens: the circle in the mask grows from the corner on load;
 *  - the band: a white highlight clipped to the squircle that sweeps across
 *    once, on load (hero) and on hover;
 *  - the halo: a blurred bloom behind the mark that rises on load, breathes
 *    gently while idle and comes up on hover (hero only).
 *
 * Colours come from the design tokens with literal fallbacks so the mark still
 * renders outside the app shell. Every id is unique per instance (useId), so
 * several marks can share a page. Keep in sync with public/favicon.svg.
 */
export default function LogoMark({
  size = 32,
  title = 'Lastframe.tv',
  decorative = false,
  className,
  variant = 'header',
  animate = 'once',
}: LogoMarkProps) {
  // useId() returns ":r0:"-style ids; colons are unsafe inside url(#...).
  const uid = `lf${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const gradId = `${uid}-grad`;
  const bandId = `${uid}-band`;
  const lensId = `${uid}-lens`;
  const clipId = `${uid}-clip`;
  const titleId = `${uid}-title`;

  const a11y = decorative
    ? ({ 'aria-hidden': true, focusable: 'false' } as const)
    : ({ role: 'img', 'aria-labelledby': titleId } as const);

  return (
    <span
      className={['logo-mark', `logo-mark--${variant}`, className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-animate={animate}
    >
      {variant === 'hero' && <span className="logo-mark__halo" aria-hidden="true" />}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="logo-mark__svg"
        {...a11y}
      >
        {!decorative && <title id={titleId}>{title}</title>}
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--logo-grad-a, #6f5bf5)' }} />
            <stop offset="1" style={{ stopColor: 'var(--logo-grad-b, #5ccbff)' }} />
          </linearGradient>
          <linearGradient id={bandId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={lensId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill="#fff" />
            <circle className="logo-mark__lens" cx="100" cy="0" r="54" fill="#000" />
          </mask>
          <clipPath id={clipId}>
            <rect x="6" y="6" width="88" height="88" rx="28" />
          </clipPath>
        </defs>
        <rect
          className="logo-mark__tile"
          x="6"
          y="6"
          width="88"
          height="88"
          rx="28"
          fill={`url(#${gradId})`}
          mask={`url(#${lensId})`}
        />
        {/* The clip and mask sit on a group so they stay put while the band
            inside it moves (an SVG clip-path follows its own element's transform). */}
        <g clipPath={`url(#${clipId})`} mask={`url(#${lensId})`}>
          <rect
            className="logo-mark__band"
            x="-40"
            y="0"
            width="40"
            height="100"
            fill={`url(#${bandId})`}
          />
        </g>
      </svg>
    </span>
  );
}
