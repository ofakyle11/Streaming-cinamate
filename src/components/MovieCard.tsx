import { ButtonHTMLAttributes, forwardRef } from 'react';
import type { Movie } from '../services';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  movie: Movie;
  delay: number;
  onSelect: (m: Movie) => void;
}

const MovieCard = forwardRef<HTMLButtonElement, Props>(function MovieCard(
  { movie, delay, onSelect, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className="card"
      style={{ transitionDelay: `${delay}ms` }}
      onClick={() => onSelect(movie)}
      aria-label={`${movie.title}, ${movie.year}`}
      {...rest}
    >
      <img src={movie.poster} alt="" loading="lazy" />
      <div className="card-info glass" aria-hidden="true">
        <strong>{movie.title}</strong>
        <span>
          <em className="match">{movie.match}%</em> · {movie.year} · {movie.genres[0]}
        </span>
      </div>
    </button>
  );
});

export default MovieCard;
