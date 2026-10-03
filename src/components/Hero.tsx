import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react';
import {
  analytics as defaultAnalytics,
  tmdb as defaultTmdb,
  type AnalyticsService,
  type Movie,
  type TmdbService,
  type TmdbVideo,
} from '../services';
import { IconButton, useOptionalToast } from './ui';
import LogoMark from './brand/LogoMark';
import TrailerModal from './title/TrailerModal';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useInView } from '../hooks/useInView';
import { useTrailerKey } from '../hooks/useTrailerKey';
import { useMyListToggle } from '../hooks/useMyListToggle';
import { useViewActions } from '../hooks/useViewHistory';
import type { Thumb } from '../state/store';
import {
  YOUTUBE_EMBED_ORIGIN,
  pickTrailerKey,
  trailerVideoFromKey,
  youTubeCommand,
  youTubeEmbedUrl,
} from '../lib/trailer';
import './title/title.css';
import './Hero.css';
import { AnalyticsEvents, track, thumbEvent } from '../services/analytics/track';

/** How long a slide must be on screen before its trailer preview starts. */
export const TRAILER_DELAY_MS = 3000;
/** Auto-advance interval for the carousel (paused while a trailer plays). */
export const SLIDE_INTERVAL_MS = 7000;

/** Stagger index for the `.lf-rise` load choreography (motion.css). */
const rise = (i: number) => ({ '--i': i }) as CSSProperties;

interface Props {
  featured: Movie[];
  onMore: (m: Movie) => void;
  /** Trailer fallback when the slide has no trailer (Home navigates to the title page). Defaults to `onMore`. */
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
  /** Full-screen trailer opened from the Trailer button. */
  const [trailer, setTrailer] = useState<{ movie: Movie; video: TmdbVideo } | null>(null);
  /** User pressed the slideshow pause button (WCAG 2.2.2). */
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  /**
   * Live-region politeness: 'off' while the carousel auto-advances (so it never
   * spams screen readers), 'polite' after the user picks a slide or pauses.
   */
  const [announce, setAnnounce] = useState(false);
  /** Id of the slide whose Trailer button is waiting on a trailer lookup. */
  const [pendingPlayId, setPendingPlayId] = useState<number | null>(null);

  const heroRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(heroRef);

  const count = featured.length;
  const movie: Movie | undefined = count ? featured[index % count] : undefined;
  const movieId = movie?.id;
  const trailerKey = useTrailerKey(movie, { svc });
  const { recordView } = useViewActions();
  const { toast } = useOptionalToast();
  const trailerOpen = trailer !== null;
  const paused = userPaused || hovering || focusWithin || trailerOpen;
  /** Cancels an in-flight trailer lookup on unmount / slide change. */
  const playLookupRef = useRef(0);
  /** Synchronous guard so repeat Trailer clicks never start another lookup. */
  const playPendingRef = useRef(false);
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
      setAnnounce(false);
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
    track(
      AnalyticsEvents.playTrailer,
      { id: m.id, mediaType: m.mediaType, source: 'hero' },
      analytics,
    );
    // Silence and pause the background preview while the full trailer plays.
    sendCommand('pauseVideo');
    sendCommand('mute');
    setMuted(true);
    setTrailer({ movie: m, video: trailerVideoFromKey(key, m.title) });
  };

  /** Drops any in-flight trailer lookup and its pending state. */
  const cancelPlayLookup = () => {
    playLookupRef.current += 1;
    playPendingRef.current = false;
    setPendingPlayId(null);
  };

  const play = (m: Movie) => {
    if (trailerKey) {
      openTrailer(m, trailerKey);
      return;
    }
    // Ignore repeat clicks while a lookup is already in flight.
    if (playPendingRef.current) return;
    // Key still loading (or none): look it up now, fall back to the title page.
    const token = ++playLookupRef.current;
    playPendingRef.current = true;
    setPendingPlayId(m.id);
    svc
      .videos(m.mediaType, m.id)
      .then(pickTrailerKey, () => null)
      .then((key) => {
        if (token !== playLookupRef.current) return;
        cancelPlayLookup();
        if (key) openTrailer(m, key);
        else onOpenTitle(m);
      });
  };

  const onThumbChange = useCallback(
    (thumb: Thumb | null) => {
      const m = trailer?.movie;
      if (!m) return;
      track(
        thumbEvent(thumb),
        {
          id: m.id,
          mediaType: m.mediaType,
          source: 'hero',
        },
        analytics,
      );
      if (thumb === 'up') toast(`Glad you liked ${m.title}`, { kind: 'success' });
      else if (thumb === 'down') toast(`Got it — we’ll show fewer titles like ${m.title}`);
      else toast(`Removed your thumb for ${m.title}`);
    },
    [trailer, analytics, toast],
  );

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
    cancelPlayLookup();
    setAnnounce(true);
    setIndex(i);
    setDwelledId(null);
    setRequestedId(null);
  };

  if (!movie) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  const slideshowControls = count > 1 && !reducedMotion;
  const current = index % count;
  const slideLabel = `${current + 1} of ${count}: ${movie.title}`;
  const playPending = pendingPlayId === movie.id;

  return (
    <>
      <section
        className={`hero${trailerReady ? ' has-trailer' : ''}`}
        ref={heroRef}
        aria-roledescription="carousel"
        aria-label="Featured titles"
      >
        <div className="hero-screen">
          {featured.map((m, i) => (
            <div
              key={m.id}
              className={`hero-bg ${i === index % count ? 'active' : ''}`}
              style={{ backgroundImage: `url(${m.backdrop})` }}
            />
          ))}
          {showTrailer && trailerKey && (
            <div
              className={`hero-trailer${trailerReady ? ' ready' : ''}`}
              data-testid="hero-trailer"
            >
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
          {/* One-shot light band across the screen on mount (outside the keyed slide so it never replays). */}
          <div className="hero-sweep" aria-hidden />
          <div className="hero-fade" />
          <div
            className="hero-copy"
            key={movie.id}
            role="group"
            aria-roledescription="slide"
            aria-label={slideLabel}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
            onFocus={() => setFocusWithin(true)}
            onBlur={handleBlur}
          >
            {/* Phase 4 drops its animated LogoMark into this slot (data-logo-slot="hero"). */}
            <div className="hero-lockup lf-rise" data-logo-slot="hero" style={rise(0)}>
              <LogoMark size={56} decorative />
            </div>
            <h1 className="lf-rise" style={rise(1)}>
              {movie.title}
            </h1>
            <div className="meta lf-rise" style={rise(2)}>
              <span className="fit">Fit {movie.match}</span>
              <span>{movie.year}</span>
              {movie.rating && <span className="badge">{movie.rating}</span>}
              <span>{movie.genres.join(' · ')}</span>
            </div>
            <p className="lf-rise" style={rise(3)}>
              {movie.description}
            </p>
            <div className="actions lf-rise" style={rise(4)}>
              <button type="button" className="btn primary hero-cta" onClick={() => onMore(movie)}>
                Where to watch
              </button>
              <button
                type="button"
                className={`btn glass hero-trailer-btn${playPending ? ' is-pending' : ''}`}
                onClick={() => play(movie)}
                aria-busy={playPending || undefined}
                aria-disabled={playPending || undefined}
              >
                {playPending && <span className="hero-trailer-spinner" aria-hidden />}
                Trailer
              </button>
              <HeroListButton movie={movie} />
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
            <div className="hero-dots" role="group" aria-label="Choose featured title">
              {featured.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className={i === current ? 'active' : ''}
                  onClick={() => goTo(i)}
                  aria-label={i === current ? `Showing ${m.title}` : `Show ${m.title}`}
                  aria-current={i === current ? 'true' : undefined}
                />
              ))}
            </div>
            {slideshowControls && (
              <IconButton
                className="hero-pause"
                size="sm"
                label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
                aria-pressed={userPaused}
                onClick={() => {
                  // Announce slides only once the user has taken control of the carousel.
                  setAnnounce(!userPaused);
                  setUserPaused((p) => !p);
                }}
              >
                <span aria-hidden>{userPaused ? '▶' : '❚❚'}</span>
              </IconButton>
            )}
          </div>
          <div
            className="hero-sr-only"
            data-testid="hero-live"
            aria-live={announce ? 'polite' : 'off'}
            aria-atomic="true"
          >
            {slideLabel}
          </div>
        </div>
      </section>
      {trailer && (
        <TrailerModal
          video={trailer.video}
          title={trailer.movie.title}
          poster={trailer.movie.backdrop}
          onClose={closeTrailer}
          movie={trailer.movie}
          onThumbChange={onThumbChange}
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
