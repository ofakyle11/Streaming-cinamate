import { useThumbActions, useThumbFor } from '../../hooks';
import type { MediaType } from '../../services/types';
import type { Thumb } from '../../state/store';
import './ratings.css';

interface Props {
  titleId: number;
  mediaType: MediaType;
  title: string;
  /** `sm` for card hover overlays, `md` (default) for the title page. */
  size?: 'sm' | 'md';
  /** Called after the thumb changes (null = cleared), e.g. for toasts/analytics. */
  onChange?: (thumb: Thumb | null) => void;
}

/** Material "thumb_up" glyph (Apache-2.0); the down variant is the same path rotated. */
const THUMB_PATH =
  'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z';

function ThumbIcon({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden focusable="false" className={down ? 'thumb-icon down' : 'thumb-icon'}>
      <path d={THUMB_PATH} fill="currentColor" />
    </svg>
  );
}

/** Thumbs up / down toggle pair, stored per profile. Pressing the active thumb clears it. */
export default function ThumbsControl({ titleId, mediaType, title, size = 'md', onChange }: Props) {
  const thumb = useThumbFor(titleId, mediaType);
  const { setThumb } = useThumbActions();

  const press = (value: Thumb) => {
    const next = thumb === value ? null : value;
    setThumb(titleId, next, { mediaType, title }, mediaType);
    onChange?.(next);
  };

  return (
    <div className={`thumbs thumbs-${size} glass`} role="group" aria-label={`Rate ${title} with thumbs`}>
      <button
        type="button"
        className={`thumb-btn${thumb === 'up' ? ' on up' : ''}`}
        aria-pressed={thumb === 'up'}
        aria-label={`I like ${title}`}
        title="I like this"
        onClick={() => press('up')}
      >
        <ThumbIcon />
      </button>
      <button
        type="button"
        className={`thumb-btn${thumb === 'down' ? ' on down' : ''}`}
        aria-pressed={thumb === 'down'}
        aria-label={`Not for me: ${title}`}
        title="Not for me"
        onClick={() => press('down')}
      >
        <ThumbIcon down />
      </button>
    </div>
  );
}
