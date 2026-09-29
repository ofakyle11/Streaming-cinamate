import { useEffect, useRef } from 'react';
import type { TmdbVideo } from '../../services';
import { IconButton } from '../ui';
import { trailerEmbedUrl } from './titleUtils';

interface Props {
  video: TmdbVideo;
  title: string;
  /** Shown behind the fallback card when the video cannot be embedded (unknown site / unsafe key). */
  poster: string;
  onClose: () => void;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function TrailerModal({ video, title, poster, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button, iframe, a[href]');
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
        className="trailer-modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trailer-title"
        onClick={(e) => e.stopPropagation()}
      >
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
            <div className="trailer-placeholder" style={{ backgroundImage: poster ? `url("${poster.replace(/["\\\n]/g, '')}")` : undefined }}>
              <div className="trailer-placeholder-card glass">
                <span className="trailer-placeholder-icon" aria-hidden>
                  ▶
                </span>
                <p>This trailer can’t be played here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
