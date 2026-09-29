import { Link } from 'react-router-dom';
import type { Movie } from '../services';

interface Props {
  movie: Movie;
  delay: number;
  onSelect?: (m: Movie) => void;
}

export default function MovieCard({ movie, delay, onSelect }: Props) {
  return (
    <Link
      className="card"
      to={`/title/${movie.mediaType}/${movie.id}`}
      style={{ transitionDelay: `${delay}ms` }}
      onClick={() => onSelect?.(movie)}
    >
      <img src={movie.poster} alt={movie.title} loading="lazy" />
      <div className="card-info glass">
        <strong>{movie.title}</strong>
        <span>
          <em className="match">{movie.match}%</em> · {movie.year} · {movie.genres[0]}
        </span>
      </div>
    </Link>
  );
}
