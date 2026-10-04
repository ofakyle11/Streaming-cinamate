import { useEffect, useRef } from 'react';
import { useMyListToggle } from '../../hooks/useMyListToggle';
import { useSheetDismiss } from '../../hooks/useSheetDismiss';
import type { Movie, TmdbVideo } from '../../services';
import type { Thumb } from '../../state/store';
import ThumbsControl from '../ratings/ThumbsControl';
import { Button, IconButton } from '../ui';
import { FOCUSABLE_SELECTOR, trailerEmbedUrl } from './titleUtils';
import './trailer-modal.css';

interface Props {
  video: TmdbVideo;
  title: string;
  /** Shown behind the fallback card when the video cannot be embedded (unknown site / unsafe key). */
  poster: string;
  onClose: () => void;
  /** When given, the dialog gets a footer with a My List toggle and thumbs (inside the focus trap). */
  movie?: Movie;
  /** Called after the footer thumbs change, e.g. for toasts/analytics. */
  onThumbChange?: (thumb: Thumb | null) => void;
}

function TrailerFooter({
  movie,
  onThumbChange,
}: {
  movie: Movie;
  onThumbChange?: (thumb: Thumb | null) => void;
}) {
  const { inList, toggle } = useMyListToggle(movie, 'modal');
  return (
    <footer className="trailer-foot">
      <Button
        variant="glass"
        size="sm"
        onClick={toggle}
        aria-pressed={inList}
        aria-label={inList ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`}
        className={`trailer-list-btn${inList ? ' is-listed' : ''}`}
      >
        <span aria-hidden>{inList ? '✓' : '＋'}</span> My List
      </Button>
      <ThumbsControl
        titleId={movie.id}
        mediaType={movie.mediaType}
        title={movie.title}
        size="sm"
        onChange={onThumbChange}
      />
    </footer>
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function TrailerModal({
  video,
  title,
  poster,
  onClose,
  movie,
  onThumbChange,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Phone and tablet: the dialog is a bottom sheet; drag it down to close.
  useSheetDismiss(dialogRef, onClose);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // Minimal focus trap: keep Tab inside the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const src = trailerEmbedUrl(video, !prefersReducedMotion());

  return (
    <div className="modal-backdrop trailer-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="trailer-modal sheet glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trailer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden />
        <header className="trailer-head">
          <h2 id="trailer-title">{video.name || `${title} trailer`}</h2>
          <IconButton ref={closeRef} label="Close trailer" onClick={onClose}>
            ✕
          </IconButton>
        </header>
        <div className="trailer-frame">
          {src ? (
            <iframe
              src={src}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div
              className="trailer-placeholder"
              style={{
                backgroundImage: poster ? `url("${poster.replace(/["\\\n]/g, '')}")` : undefined,
              }}
            >
              <div className="trailer-placeholder-card glass">
                <span className="trailer-placeholder-icon" aria-hidden>
                  ▶
                </span>
                <p>This trailer can’t be played here.</p>
              </div>
            </div>
          )}
        </div>
        {movie && <TrailerFooter movie={movie} onThumbChange={onThumbChange} />}
      </div>
    </div>
  );
}
