import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Movie } from '../services';
import { titlePath } from '../pages/homeRows';
import { useMyListToggle, type MyListSource } from '../hooks/useMyListToggle';
import { IconButton } from './ui';
import CardRating from './ratings/CardRating';
import './MovieCard.css';

interface Props {
  movie: Movie;
  delay: number;
  /** Optional side effect (e.g. analytics) when the card is opened. Navigation is handled by the link. */
  onSelect?: (m: Movie) => void;
  /** Show the hover add/remove My List button. Default true. */
  listToggle?: boolean;
  /** Analytics source for the My List toggle. Default 'card'. */
  listSource?: MyListSource;
  /**
   * Optional extra overlay (e.g. a remove button or progress bar) rendered as a
   * sibling of the link, after the built-in overlays. Buttons are safe here.
   */
  extraAction?: ReactNode;
}

export default function MovieCard({ movie, delay, onSelect, listToggle = true, listSource = 'card', extraAction }: Props) {
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
      {listToggle && <CardListToggle movie={movie} source={listSource} />}
      <CardRating movie={movie} />
      {extraAction}
    </div>
  );
}

function CardListToggle({ movie, source }: { movie: Movie; source: MyListSource }) {
  const { inList, toggle } = useMyListToggle(movie, source);
  return (
    <IconButton
      size="sm"
      glass={false}
      className={`card-list-btn${inList ? ' is-listed' : ''}`}
      label={inList ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`}
      aria-pressed={inList}
      onClick={toggle}
    >
      <span aria-hidden>{inList ? '✓' : '＋'}</span>
    </IconButton>
  );
}
