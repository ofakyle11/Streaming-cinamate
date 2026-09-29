import { CSSProperties, HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'rect' | 'text' | 'circle' | 'card';
  width?: number | string;
  height?: number | string;
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/** Glass shimmer placeholder. Purely decorative; hidden from assistive tech. */
export default function Skeleton({ variant = 'rect', width, height, className, style, ...rest }: SkeletonProps) {
  const s: CSSProperties = { ...style };
  if (width !== undefined) s.width = width;
  if (height !== undefined) s.height = height;
  return <span aria-hidden className={cx('skeleton', variant !== 'rect' && variant, className)} style={s} {...rest} />;
}
