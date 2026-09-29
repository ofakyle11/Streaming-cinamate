import { useEffect, useId, useRef, useState } from 'react';
import { useRatingActions, useRatingFor } from '../../hooks';
import type { Rating } from '../../state/store';
import { Button, useToast } from '../ui';

interface Props {
  titleId: number;
  title: string;
}

const STARS: Rating[] = [1, 2, 3, 4, 5];
const LABELS: Record<Rating, string> = { 1: 'Not for me', 2: 'Meh', 3: 'Good', 4: 'Great', 5: 'Loved it' };

/** "Rate" action: opens a glass popover with a 1–5 star radio group. */
export default function RatingControl({ titleId, title }: Props) {
  const rating = useRatingFor(titleId);
  const { rate, clear } = useRatingActions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (r: Rating) => {
    rate(titleId, r);
    setOpen(false);
    toast(`Rated ${title} ${r}/5 — ${LABELS[r]}`, { kind: 'success' });
  };

  const reset = () => {
    clear(titleId);
    setOpen(false);
    toast(`Removed your rating for ${title}`);
  };

  return (
    <div className="rate-wrap" ref={wrapRef}>
      <Button
        variant="glass"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={rating ? 'is-rated' : undefined}
      >
        <span aria-hidden>{rating ? '★' : '☆'}</span>
        {rating ? `Rated ${rating}/5` : 'Rate'}
      </Button>
      {open && (
        <div id={popId} className="rate-pop glass">
          <div role="radiogroup" aria-label={`Rate ${title}`} className="rate-stars">
            {STARS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={rating === s}
                aria-label={`${s} star${s > 1 ? 's' : ''} — ${LABELS[s]}`}
                className={`rate-star${rating && s <= rating ? ' on' : ''}`}
                onClick={() => choose(s)}
              >
                ★
              </button>
            ))}
          </div>
          {rating && (
            <button type="button" className="rate-clear" onClick={reset}>
              Clear rating
            </button>
          )}
        </div>
      )}
    </div>
  );
}
