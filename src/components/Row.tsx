import { useEffect, useId, useRef, useState } from 'react';
import type { Movie } from '../services';
import { useRovingFocus } from '../hooks/useRovingFocus';
import MovieCard from './MovieCard';

interface Props {
  title: string;
  items: Movie[];
  onSelect: (m: Movie) => void;
}

export default function Row({ title, items, onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const headingId = useId();
  const trackId = useId();
  const { getItemProps } = useRovingFocus<HTMLButtonElement>(items.length);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
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

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section ref={sectionRef} className={`row ${visible ? 'in' : ''}`} aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      <div className="row-wrap">
        {/* Pointer helpers: keyboard users browse with arrow keys, so these stay out of the tab order. */}
        <button
          type="button"
          className="arrow left glass"
          onClick={() => scroll(-1)}
          aria-label={`Scroll ${title} left`}
          aria-controls={trackId}
          tabIndex={-1}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="track" ref={trackRef} id={trackId} role="group" aria-label={title}>
          {items.map((m, i) => (
            <MovieCard
              key={`${title}-${m.id}`}
              movie={m}
              delay={i * 60}
              onSelect={onSelect}
              {...getItemProps(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="arrow right glass"
          onClick={() => scroll(1)}
          aria-label={`Scroll ${title} right`}
          aria-controls={trackId}
          tabIndex={-1}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}
