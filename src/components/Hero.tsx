import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import {
  analytics as defaultAnalytics,
  tmdb as defaultTmdb,
  type AnalyticsService,
  type Movie,
  type TmdbService,
  type TmdbVideo,
} from '../services';
import { IconButton } from './ui';
import TrailerModal from './title/TrailerModal';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useInView } from '../hooks/useInView';
import { useTrailerKey } from '../hooks/useTrailerKey';
import { useMyListToggle } from '../hooks/useMyListToggle';
import { useViewActions } from '../hooks/useViewHistory';
import {
  YOUTUBE_EMBED_ORIGIN,
  pickTrailerKey,
  trailerVideoFromKey,
  youTubeCommand,
  youTubeEmbedUrl,
} from '../lib/trailer';
import './title/title.css';
import './Hero.css';

/** How long a slide must be on screen before its trailer preview starts. */
export const TRAILER_DELAY_MS = 3000;
/** Auto-advance interval for the carousel (paused while a trailer plays). */
export const SLIDE_INTERVAL_MS = 7000;

interface Props {
  featured: Movie[];
  onMore: (m: Movie) => void;
  /** Play fallback when the slide has no trailer (Home navigates to the title page). Defaults to `onMore`. */
  onOpenTitle?: (m: Movie) => void;
  /** Service overrides (tests). */
  svc?: TmdbService;
  analytics?: AnalyticsService;
}

export default function Hero({
  featured,
  onMore,
  onOpenTitle = onMore,
  svc = defaultTmdb,
  analytics = defaultAnalytics,
}: Props) {
  const [index, setIndex] = useState(0);
  /** Id of the slide that has been on screen for TRAILER_DELAY_MS. */
  const [dwelledId, setDwelledId] = useState<number | null>(null);
  /** Reduced motion: id of the slide whose preview the user explicitly started. */
  const [requestedId, setRequestedId] = useState<number | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  /** Full-screen trailer opened from the Play button. */
  const [trailer, setTrailer] = useState<{ movie: Movie; video: TmdbVideo } | null>(null);
  /** User pressed the slideshow pause button (WCAG 2.2.2). */
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(heroRef);

  const count = featured.length;
  const movie: Movie | undefined = count ? featured[index % count] : undefined;
  const movieId = movie?.id;
  const trailerKey = useTrailerKey(movie, { svc });
  const { recordView } = useViewActions();
  const trailerOpen = trailer !== null;
  const paused = userPaused || hovering || focusWithin || trailerOpen;
  /** Cancels an in-flight Play lookup on unmount / slide change. */
  const playLookupRef = useRef(0);
  useEffect(() => () => void (playLookupRef.current += 1), []);

  const showTrailer =
    Boolean(trailerKey) &&
    inView &&
    movieId != null &&
    (reducedMotion ? requestedId === movieId : dwelledId === movieId);
  const trailerReady = showTrailer && loadedKey === trailerKey;

  // Start the dwell timer for each slide (never autoplays under reduced motion,
  // and never starts a new preview behind the trailer modal).
  useEffect(() => {
    if (movieId == null || reducedMotion || trailerOpen) return;
    const t = setTimeout(() => setDwelledId(movieId), TRAILER_DELAY_MS);
    return () => clearTimeout(t);
  }, [movieId, reducedMotion, trailerOpen]);

  // Auto-advance; paused while a trailer is on screen, motion is reduced, the user
  // paused the slideshow, or the pointer / focus is on the hero.
  useEffect(() => {
    if (count < 2 || reducedMotion || showTrailer || paused) return;
    const t = setTimeout(() => {
      setDwelledId(null);
      setIndex((i) => (i + 1) % count);
    }, SLIDE_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, count, reducedMotion, showTrailer, paused]);

  const sendCommand = useCallback((func: Parameters<typeof youTubeCommand>[0]) => {
    iframeRef.current?.contentWindow?.postMessage(youTubeCommand(func), YOUTUBE_EMBED_ORIGIN);
  }, []);

  const openTrailer = (m: Movie, key: string) => {
    recordView(m, 'trailer');
    analytics.track('trailer_open', { id: m.id, mediaType: m.mediaType, source: 'hero' });
    // Silence and pause the background preview while the full trailer plays.
    sendCommand('pauseVideo');
    sendCommand('mute');
    setMuted(true);
    setTrailer({ movie: m, video: trailerVideoFromKey(key, m.title) });
  };

  const play = (m: Movie) => {
    if (trailerKey) {
      openTrailer(m, trailerKey);
      return;
    }
    // Key still loading (or none): look it up now, fall back to the title page.
    const token = ++playLookupRef.current;
    svc
      .videos(m.mediaType, m.id)
      .then(pickTrailerKey, () => null)
      .then((key) => {
        if (token !== playLookupRef.current) return;
        if (key) openTrailer(m, key);
        else onOpenTitle(m);
      });
  };

  const closeTrailer = useCallback(() => {
    setTrailer(null);
    sendCommand('playVideo');
  }, [sendCommand]);

  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
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
    playLookupRef.current += 1;
    setIndex(i);
    setDwelledId(null);
    setRequestedId(null);
  };

  if (!movie) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  const slideshowControls = count > 1 && !reducedMotion;

  return (
    <>
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
        <div
          className="hero-card glass"
          key={movie.id}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          onFocus={() => setFocusWithin(true)}
          onBlur={handleBlur}
        >
          <h1>{movie.title}</h1>
          <div className="meta">
            <span className="match">{movie.match}% Match</span>
            <span>{movie.year}</span>
            <span className="badge">{movie.rating}</span>
            <span>{movie.genres.join(' · ')}</span>
          </div>
          <p>{movie.description}</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => play(movie)}>
              <span aria-hidden>▶</span> Play
            </button>
            <HeroListButton movie={movie} />
            <button type="button" className="btn glass" onClick={() => onMore(movie)}>
              <span aria-hidden>ⓘ</span> More Info
            </button>
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
              <IconButton
                label={muted ? 'Unmute trailer' : 'Mute trailer'}
                aria-pressed={!muted}
                onClick={toggleMute}
              >
                <SpeakerIcon muted={muted} />
              </IconButton>
            )}
          </div>
        )}
        <div className="hero-nav">
          <div className="hero-dots">
            {featured.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={i === index % count ? 'active' : ''}
                onClick={() => goTo(i)}
                aria-label={`Show ${m.title}`}
                aria-current={i === index % count ? 'true' : undefined}
              />
            ))}
          </div>
          {slideshowControls && (
            <IconButton
              className="hero-pause"
              size="sm"
              label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
              aria-pressed={userPaused}
              onClick={() => setUserPaused((p) => !p)}
            >
              <span aria-hidden>{userPaused ? '▶' : '❚❚'}</span>
            </IconButton>
          )}
        </div>
      </header>
      {trailer && (
        <TrailerModal
          video={trailer.video}
          title={trailer.movie.title}
          poster={trailer.movie.backdrop}
          onClose={closeTrailer}
        />
      )}
    </>
  );
}

function HeroListButton({ movie }: { movie: Movie }) {
  const { inList, toggle } = useMyListToggle(movie, 'hero');
  return (
    <button
      type="button"
      className={`btn glass hero-list-btn${inList ? ' is-listed' : ''}`}
      aria-pressed={inList}
      onClick={toggle}
    >
      <span aria-hidden>{inList ? '✓' : '＋'}</span> My List
    </button>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l6 6M22 9l-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
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
