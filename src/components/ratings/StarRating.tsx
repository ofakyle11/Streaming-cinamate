import { useRatingActions, useRatingFor } from '../../hooks';
import type { MediaType } from '../../services/types';
import type { Rating } from '../../state/store';
import './ratings.css';

interface Props {
  titleId: number;
  mediaType: MediaType;
  title: string;
}

const STARS: Rating[] = [1, 2, 3, 4, 5];

/**
 * Compact, optional 1–5 star rating for card hover overlays.
 * Choosing the current value again clears the rating.
 */
export default function StarRating({ titleId, mediaType, title }: Props) {
  const rating = useRatingFor(titleId);
  const { rate, clear } = useRatingActions();

  const choose = (s: Rating) => {
    if (rating === s) clear(titleId);
    else rate(titleId, s, { mediaType, title });
  };

  return (
    <div role="radiogroup" aria-label={`Stars for ${title}`} className="mini-stars">
      {STARS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={rating === s}
          aria-label={`${s} out of 5`}
          className={`mini-star${rating && s <= rating ? ' on' : ''}`}
          onClick={() => choose(s)}
        >
          <span aria-hidden>★</span>
        </button>
      ))}
    </div>
  );
}
