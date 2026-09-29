import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Movie } from '../services';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import MovieCard from './MovieCard';
import { ROW_SCROLL_STEP, measureTrack, sameTrackState, type TrackState } from './rowTrack';
import './Row.css';

interface Props {
  title: string;
  items: Movie[];
  onSelect?: (m: Movie) => void;
}

export default function Row({ title, items, onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const uid = useId();
  const headingId = `row-title-${uid}`;
  const trackId = `row-track-${uid}`;
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
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
      { threshold: 0.15 }
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

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    if ((dir === -1 && track.atStart) || (dir === 1 && track.atEnd)) return;
    el.scrollBy({ left: dir * el.clientWidth * ROW_SCROLL_STEP, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <section ref={sectionRef} className={`row ${visible ? 'in' : ''}`} aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
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
          ‹
        </button>
        <div className="track" id={trackId} ref={trackRef}>
          {items.map((m, i) => (
            <MovieCard key={`${m.mediaType}-${m.id}`} movie={m} delay={i * 60} onSelect={onSelect} />
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
          ›
        </button>
      </div>
    </section>
  );
}
