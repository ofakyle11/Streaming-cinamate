import { useEffect, useRef, useState } from 'react';
import type { Movie } from '../services';
import MovieCard from './MovieCard';

interface Props {
  title: string;
  items: Movie[];
  onSelect?: (m: Movie) => void;
}

export default function Row({ title, items, onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

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
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section ref={sectionRef} className={`row ${visible ? 'in' : ''}`}>
      <h2>{title}</h2>
      <div className="row-wrap">
        <button className="arrow left glass" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
        <div className="track" ref={trackRef}>
          {items.map((m, i) => (
            <MovieCard key={`${title}-${m.id}`} movie={m} delay={i * 60} onSelect={onSelect} />
          ))}
        </div>
        <button className="arrow right glass" onClick={() => scroll(1)} aria-label="Scroll right">›</button>
      </div>
    </section>
  );
}
