import type { Thumb } from '../../state/store';

/** Toast copy for a thumb change; matches the title page. */
export function thumbToastMessage(title: string, thumb: Thumb | null): string {
  if (thumb === 'up') return `Glad you liked ${title}`;
  if (thumb === 'down') return `Got it — we’ll show fewer titles like ${title}`;
  return `Removed your thumb for ${title}`;
}
