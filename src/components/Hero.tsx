import { useEffect, useRef, useState } from 'react';
import type { Movie } from '../services';
import { IconButton } from './ui';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useInView } from '../hooks/useInView';
import { useTrailerKey } from '../hooks/useTrailerKey';
import { YOUTUBE_EMBED_ORIGIN, youTubeCommand, youTubeEmbedUrl } from '../lib/trailer';
import './Hero.css';

/** How long a slide must be on screen before its trailer preview starts. */
export const TRAILER_DELAY_MS = 3000;
/** Auto-advance interval for the carousel (paused while a trailer plays). */
export const SLIDE_INTERVAL_MS = 7000;

interface Props {
  featured: Movie[];
  onMore: (m: Movie) => void;
}

export default function Hero({ featured, onMore }: Props) {
  const [index, setIndex] = useState(0);
  /** Id of the slide that has been on screen for TRAILER_DELAY_MS. */
  const [dwelledId, setDwelledId] = useState<number | null>(null);
  /** Reduced motion: id of the slide whose preview the user explicitly started. */
  const [requestedId, setRequestedId] = useState<number | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const heroRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(heroRef);

  const count = featured.length;
  const movie: Movie | undefined = count ? featured[index % count] : undefined;
  const movieId = movie?.id;
  const trailerKey = useTrailerKey(movie);

  const showTrailer =
    Boolean(trailerKey) &&
    inView &&
    movieId != null &&
    (reducedMotion ? requestedId === movieId : dwelledId === movieId);
  const trailerReady = showTrailer && loadedKey === trailerKey;

  // Start the dwell timer for each slide (never autoplays under reduced motion).
  useEffect(() => {
    if (movieId == null || reducedMotion) return;
    const t = setTimeout(() => setDwelledId(movieId), TRAILER_DELAY_MS);
    return () => clearTimeout(t);
  }, [movieId, reducedMotion]);

  // Auto-advance; paused while a trailer is on screen or motion is reduced.
  useEffect(() => {
    if (count < 2 || reducedMotion || showTrailer) return;
    const t = setTimeout(() => {
      setDwelledId(null);
      setIndex((i) => (i + 1) % count);
    }, SLIDE_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, count, reducedMotion, showTrailer]);

  const sendCommand = (func: Parameters<typeof youTubeCommand>[0]) => {
    iframeRef.current?.contentWindow?.postMessage(youTubeCommand(func), YOUTUBE_EMBED_ORIGIN);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sendCommand(next ? 'mute' : 'unMute');
  };

  const handleIframeLoad = () => {
    if (!trailerKey) return;
    // The embed always starts muted (autoplay policy); re-apply the user's choice.
    if (!muted) sendCommand('unMute');
    setLoadedKey(trailerKey);
  };

  const goTo = (i: number) => {
    setIndex(i);
    setDwelledId(null);
    setRequestedId(null);
  };

  if (!movie) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  return (
    <header className={`hero${trailerReady ? ' has-trailer' : ''}`} ref={heroRef}>
      {featured.map((m, i) => (
        <div
          key={m.id}
          className={`hero-bg ${i === index % count ? 'active' : ''}`}
          style={{ backgroundImage: `url(${m.backdrop})` }}
        />
      ))}
      {showTrailer && trailerKey && (
        <div className={`hero-trailer${trailerReady ? ' ready' : ''}`} data-testid="hero-trailer">
          <iframe
            key={trailerKey}
            ref={iframeRef}
            src={youTubeEmbedUrl(trailerKey, origin)}
            title={`${movie.title} trailer preview`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={handleIframeLoad}
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
      {trailerKey && (
        <div className="hero-trailer-controls">
          {reducedMotion && (
            <IconButton
              label={showTrailer ? 'Stop trailer preview' : 'Play trailer preview'}
              aria-pressed={showTrailer}
              onClick={() => setRequestedId(showTrailer ? null : movie.id)}
            >
              {showTrailer ? '■' : '▶'}
            </IconButton>
          )}
          {showTrailer && (
            <IconButton label={muted ? 'Unmute trailer' : 'Mute trailer'} aria-pressed={!muted} onClick={toggleMute}>
              <SpeakerIcon muted={muted} />
            </IconButton>
          )}
        </div>
      )}
      <div className="hero-dots">
        {featured.map((m, i) => (
          <button
            key={m.id}
            className={i === index % count ? 'active' : ''}
            onClick={() => goTo(i)}
            aria-label={`Show ${m.title}`}
            aria-current={i === index % count ? 'true' : undefined}
          />
        ))}
      </div>
    </header>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {muted ? (
        <path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}
