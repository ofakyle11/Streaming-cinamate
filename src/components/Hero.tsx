import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Movie } from '../services';

interface Props {
  featured: Movie[];
  onMore: (m: Movie) => void;
}

/** Delay on a slide before the trailer preview is loaded. */
const TRAILER_DELAY_MS = 3000;
const SLIDE_MS = 7000;
const YT_ORIGIN = 'https://www.youtube-nocookie.com';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(REDUCED_QUERY);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** True while the element is on screen and the tab is visible. */
function useIsVisible(ref: RefObject<Element>): boolean {
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  useEffect(() => {
    const on = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return inView && pageVisible;
}

function trailerSrc(key: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: key,
    playsinline: '1',
    modestbranding: '1',
    rel: '0',
    enablejsapi: '1',
  });
  return `${YT_ORIGIN}/embed/${encodeURIComponent(key)}?${params.toString()}`;
}

export default function Hero({ featured, onMore }: Props) {
  const [index, setIndex] = useState(0);
  // Each piece of trailer state records the slide it belongs to, so changing slide resets it implicitly.
  const [trailerFor, setTrailerFor] = useState<number | null>(null);
  const [readyFor, setReadyFor] = useState<number | null>(null);
  const [unmutedFor, setUnmutedFor] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const visible = useIsVisible(heroRef);

  const movie = featured[index];
  const trailerKey = movie?.trailerKey;
  const trailerReady = readyFor === index;
  const muted = unmutedFor !== index;
  const trailerActive = trailerFor === index && visible && !reducedMotion && Boolean(trailerKey);

  // Advance slides, but hold while a trailer is playing.
  useEffect(() => {
    if (featured.length < 2 || trailerActive) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % featured.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [featured.length, trailerActive]);

  // After 3s on a slide, start the (muted) trailer preview.
  useEffect(() => {
    if (!trailerKey || reducedMotion || !visible) return;
    const t = setTimeout(() => setTrailerFor(index), TRAILER_DELAY_MS);
    return () => clearTimeout(t);
  }, [index, trailerKey, reducedMotion, visible]);

  const toggleMute = () => {
    const next = !muted;
    setUnmutedFor(next ? null : index);
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }),
      YT_ORIGIN,
    );
  };

  if (!movie) return null;

  return (
    <header className="hero" ref={heroRef}>
      {featured.map((m, i) => (
        <div
          key={m.id}
          className={`hero-bg ${i === index ? 'active' : ''}`}
          style={{ backgroundImage: `url(${m.backdrop})` }}
        />
      ))}
      {trailerActive && trailerKey && (
        <div className={`hero-trailer ${trailerReady ? 'visible' : ''}`} aria-hidden="true">
          <iframe
            ref={frameRef}
            key={`${trailerKey}-${index}`}
            src={trailerSrc(trailerKey)}
            title={`${movie.title} trailer`}
            tabIndex={-1}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setReadyFor(index)}
          />
        </div>
      )}
      <div className="hero-fade" />
      <div className="hero-card glass" key={movie.id}>
        <h1>{movie.title}</h1>
        <div className="meta">
          <span className="match">{movie.match}% Match</span>
          <span>{movie.year}</span>
          <span className="badge">{movie.rating}</span>
          <span>{movie.genres.join(' · ')}</span>
        </div>
        <p>{movie.description}</p>
        <div className="actions">
          <button className="btn primary">▶ Play</button>
          <button className="btn glass" onClick={() => onMore(movie)}>ⓘ More Info</button>
        </div>
      </div>
      {trailerActive && (
        <button
          type="button"
          className="btn glass hero-mute"
          onClick={toggleMute}
          aria-pressed={!muted}
          aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
      <div className="hero-dots">
        {featured.map((m, i) => (
          <button
            key={m.id}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
            aria-label={`Show ${m.title}`}
          />
        ))}
      </div>
    </header>
  );
}
