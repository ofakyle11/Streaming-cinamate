import { Link } from 'react-router-dom';
import type { Movie } from '../services';
import { titlePath } from '../pages/homeRows';
import CardRating from './ratings/CardRating';
import './MovieCard.css';

interface Props {
  movie: Movie;
  delay: number;
  /** Optional side effect (e.g. analytics) when the card is opened. Navigation is handled by the link. */
  onSelect?: (m: Movie) => void;
}

export default function MovieCard({ movie, delay, onSelect }: Props) {
  return (
    <div className="card" style={{ transitionDelay: `${delay}ms` }}>
      <Link
        to={titlePath(movie)}
        className="card-link"
        aria-label={`${movie.title} (${movie.year})`}
        onClick={onSelect ? () => onSelect(movie) : undefined}
      >
        <img src={movie.poster} alt="" loading="lazy" />
        <div className="card-info glass">
          <strong>{movie.title}</strong>
          <span>
            <em className="match">{movie.match}%</em> · {movie.year}
            {movie.genres[0] ? ` · ${movie.genres[0]}` : ''}
          </span>
        </div>
      </Link>
      <CardRating movie={movie} />
    </div>
  );
}
