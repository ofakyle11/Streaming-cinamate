import { useEffect, useId, useRef } from 'react';
import type { Movie } from '../services';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  movie: Movie;
  onClose: () => void;
}

export default function DetailModal({ movie, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  // Traps Tab, closes on Escape and restores focus to the card that opened the dialog.
  useFocusTrap(dialogRef, true, { onEscape: onClose, initialFocus: closeRef });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <button
          ref={closeRef}
          type="button"
          className="close glass"
          onClick={onClose}
          aria-label="Close details"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div className="modal-hero" style={{ backgroundImage: `url(${movie.backdrop})` }}>
          <div className="modal-hero-fade" />
          <h2 id={titleId}>{movie.title}</h2>
        </div>
        <div className="modal-body">
          <div className="meta">
            <span className="match">{movie.match}% Match</span>
            <span>{movie.year}</span>
            <span className="badge" aria-label={`Rated ${movie.rating}`}>
              {movie.rating}
            </span>
          </div>
          <p id={descId}>{movie.description}</p>
          <p className="genres">Genres: {movie.genres.join(', ')}</p>
          <div className="actions">
            <button type="button" className="btn primary">
              <span aria-hidden="true">▶ </span>Play
            </button>
            <button type="button" className="btn glass">
              <span aria-hidden="true">＋ </span>My List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
