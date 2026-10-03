import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Movie } from '../services';
import { useRovingFocus } from '../hooks/useRovingFocus';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useKeepFocusOnRemoval, useKeepFocusOnUnmount } from '../hooks/useKeepFocusOnRemoval';
import MovieCard from './MovieCard';
import { ROW_SCROLL_STEP, measureTrack, sameTrackState, type TrackState } from './rowTrack';
import './Row.css';

interface Props {
  title: string;
  items: Movie[];
  onSelect?: (m: Movie) => void;
  /** Optional per-card overlay passed to MovieCard's `extraAction` slot. */
  cardExtra?: (m: Movie) => ReactNode;
  /** Passed to every card; false on pages whose backdrop already carries `lf-artwork`. */
  artworkTransition?: boolean;
}

const cardKey = (m: Movie) => `${m.mediaType}-${m.id}`;

export default function Row({ title, items, onSelect, cardExtra, artworkTransition }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const uid = useId();
  const headingId = `row-title-${uid}`;
  const trackId = `row-track-${uid}`;
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  // Keyboard: one tab stop per row; arrow keys / Home / End move between cards.
  const { getItemProps } = useRovingFocus<HTMLAnchorElement>(items.length);
  const [track, setTrack] = useState<TrackState>({ overflows: false, atStart: true, atEnd: true });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const next = measureTrack(el);
    setTrack((prev) => (sameTrackState(prev, next) ? prev : next));
  }, []);

  // Track scroll position (rAF-throttled) and size changes to drive arrow state.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    ro?.observe(el);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [update]);

  // Content changes can alter the scroll range without a resize.
  useEffect(() => {
    update();
  }, [items, update]);

  // A card that held focus can unmount (removed, rated away): keep keyboard users in the row.
  const focusKeeper = useKeepFocusOnRemoval(trackRef, items.map(cardKey), {
    fallback: () => headingRef.current,
    reduceMotion,
  });
  // Parents drop a row once it is empty (history, "Because you liked"): if it held focus, hand it to a neighbour.
  useKeepFocusOnUnmount(sectionRef, reduceMotion);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    if ((dir === -1 && track.atStart) || (dir === 1 && track.atEnd)) return;
    el.scrollBy({
      left: dir * el.clientWidth * ROW_SCROLL_STEP,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section ref={sectionRef} className={`row ${visible ? 'in' : ''}`} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <div className={`row-wrap${track.overflows ? ' overflows' : ''}`}>
        <button
          type="button"
          className="arrow left glass"
          onClick={() => scroll(-1)}
          aria-label={`Scroll ${title} left`}
          aria-controls={trackId}
          aria-disabled={track.atStart}
          hidden={!track.overflows}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div
          className="track"
          id={trackId}
          ref={trackRef}
          role="group"
          aria-label={title}
          {...focusKeeper}
        >
          {items.map((m, i) => (
            <MovieCard
              key={cardKey(m)}
              movie={m}
              delay={Math.min(i, 4) * 50}
              onSelect={onSelect}
              extraAction={cardExtra?.(m)}
              rovingProps={getItemProps(i)}
              artworkTransition={artworkTransition}
            />
          ))}
        </div>
        <button
          type="button"
          className="arrow right glass"
          onClick={() => scroll(1)}
          aria-label={`Scroll ${title} right`}
          aria-controls={trackId}
          aria-disabled={track.atEnd}
          hidden={!track.overflows}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}
