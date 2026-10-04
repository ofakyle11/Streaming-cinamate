import type { CSSProperties } from 'react';
import BrandMark from './BrandMark';
import { DEFAULT_COLOURWAY, WORDMARK, type ColourwayId, type MarkId } from './marks';

export interface WordmarkProps {
  /** CSS font-size for the wordmark; letter-spacing and weight follow the kit. */
  size?: number | string;
  className?: string;
}

/** The "LAST FRAME" wordmark as live text, in the display voice. */
export function Wordmark({ size, className }: WordmarkProps) {
  return (
    <span
      className={['lf-wordmark', className].filter(Boolean).join(' ')}
      style={size != null ? { fontSize: size } : undefined}
    >
      {WORDMARK}
    </span>
  );
}

export interface LockupProps {
  mark: MarkId;
  colourway?: ColourwayId;
  /** Mark size in px; the wordmark scales from it. Defaults to 40. */
  size?: number;
  /** Horizontal (mark then wordmark) or stacked (mark above wordmark). */
  orientation?: 'horizontal' | 'stacked';
  /** Accessible name for the whole lockup. Defaults to "Lastframe.tv". */
  label?: string;
  /** Hide from assistive tech (e.g. a reflection or a mockup already described). */
  decorative?: boolean;
  className?: string;
}

/** Mark plus wordmark, announced once as a single image. */
export default function Lockup({
  mark,
  colourway = DEFAULT_COLOURWAY,
  size = 40,
  orientation = 'horizontal',
  label = 'Lastframe.tv',
  decorative = false,
  className,
}: LockupProps) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };
  return (
    <span
      {...a11y}
      className={['lf-lockup', `lf-lockup--${orientation}`, className].filter(Boolean).join(' ')}
      style={{ '--lf-size': `${size}px` } as CSSProperties}
    >
      <BrandMark mark={mark} colourway={colourway} size={size} decorative />
      <Wordmark />
    </span>
  );
}
