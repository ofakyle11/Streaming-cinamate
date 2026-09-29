import type { Movie } from '../../services/types';
import StarRating from './StarRating';
import ThumbsControl from './ThumbsControl';
import './ratings.css';

/**
 * Glass overlay shown on card hover / keyboard focus: thumbs plus optional stars.
 * Rendered as a sibling of the card link so its buttons never trigger navigation.
 */
export default function CardRating({ movie }: { movie: Movie }) {
  return (
    <div className="card-rate">
      <ThumbsControl titleId={movie.id} mediaType={movie.mediaType} title={movie.title} size="sm" />
      <div className="card-rate-stars glass">
        <StarRating titleId={movie.id} mediaType={movie.mediaType} title={movie.title} />
      </div>
    </div>
  );
}
