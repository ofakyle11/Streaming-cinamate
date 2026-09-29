import { useEffect } from 'react';
import type { Movie } from '../services';

interface Props {
  movie: Movie;
  onClose: () => void;
}

export default function DetailModal({ movie, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <button className="close glass" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-hero" style={{ backgroundImage: `url(${movie.backdrop})` }}>
          <div className="modal-hero-fade" />
          <h2>{movie.title}</h2>
        </div>
        <div className="modal-body">
          <div className="meta">
            <span className="match">{movie.match}% Match</span>
            <span>{movie.year}</span>
            <span className="badge">{movie.rating}</span>
          </div>
          <p>{movie.description}</p>
          <p className="genres">Genres: {movie.genres.join(', ')}</p>
          <div className="actions">
            <button className="btn primary">▶ Play</button>
            <button className="btn glass">＋ My List</button>
          </div>
        </div>
      </div>
    </div>
  );
}
