import { useCallback } from 'react';
import { useThumbActions, useThumbFor } from '../../hooks';
import { analytics } from '../../services';
import type { Movie } from '../../services/types';
import type { Thumb } from '../../state/store';
import { useOptionalToast } from '../ui';
import StarRating from './StarRating';
import { thumbToastMessage } from './thumbToast';
import ThumbsControl from './ThumbsControl';
import './ratings.css';

/**
 * Glass overlay shown on card hover / keyboard focus: thumbs plus optional stars.
 * Rendered as a sibling of the card link so its buttons never trigger navigation.
 * Thumbing toasts (with Undo when a thumb is set, since rated cards can vanish from
 * "Because you liked" rows).
 */
export default function CardRating({ movie }: { movie: Movie }) {
  const { id, mediaType, title } = movie;
  const previous = useThumbFor(id, mediaType);
  const { setThumb } = useThumbActions();
  // Optional so cards still render in isolation (tests) without a ToastProvider.
  const { toast } = useOptionalToast();

  const onThumb = useCallback(
    (thumb: Thumb | null) => {
      analytics.track(thumb ? `thumb_${thumb}` : 'thumb_clear', { id, mediaType, source: 'card' });
      toast(thumbToastMessage(title, thumb), {
        kind: thumb === 'up' ? 'success' : 'info',
        ...(thumb && {
          duration: 6000,
          action: { label: 'Undo', onAction: () => setThumb(id, previous, { mediaType, title }, mediaType) },
        }),
      });
    },
    [id, mediaType, previous, setThumb, title, toast],
  );

  return (
    <div className="card-rate">
      <ThumbsControl titleId={id} mediaType={mediaType} title={title} size="sm" onChange={onThumb} />
      <div className="card-rate-stars glass">
        <StarRating titleId={id} mediaType={mediaType} title={title} />
      </div>
    </div>
  );
}
