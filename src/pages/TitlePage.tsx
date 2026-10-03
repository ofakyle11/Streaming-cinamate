import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Row from '../components/Row';
import CastStrip from '../components/title/CastStrip';
import ThumbsControl from '../components/ratings/ThumbsControl';
import RatingControl from '../components/title/RatingControl';
import TitleBackdrop from '../components/title/TitleBackdrop';
import TitleSkeleton from '../components/title/TitleSkeleton';
import TrailerModal from '../components/title/TrailerModal';
import WhereToWatch from '../components/title/WhereToWatch';
import '../components/title/title.css';
import { Button, useToast } from '../components/ui';
import { useViewActions } from '../hooks';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useMyListToggle } from '../hooks/useMyListToggle';
import { formatRuntime, useTitleDetails, type TitleDetails } from '../hooks/useTitleDetails';
import type { Movie } from '../services';
import { AnalyticsEvents, thumbEvent, track, trackPage } from '../services/analytics/track';
import type { Thumb } from '../state/store';
import ErrorCard from '../components/errors/ErrorCard';
import { useMeta } from '../hooks/useMeta';

function TitleNotFound({ type, id }: { type?: string; id?: string }) {
  useMeta({ title: 'Title not found', noindex: true });
  return (
    <main className="title-page title-page-empty">
      <section className="title-state glass" role="alert">
        <span className="title-state-icon" aria-hidden>
          🎞️
        </span>
        <h1>We couldn’t find that title</h1>
        <p className="muted">
          There’s no {type === 'tv' ? 'series' : type === 'movie' ? 'movie' : 'title'} matching
          {id ? ` “${id}”` : ' that link'}. It may have been removed, or the link is mistyped.
        </p>
        <div className="title-actions">
          <Link className="btn primary" to="/">
            Back home
          </Link>
          <Link className="btn glass" to="/search">
            Search titles
          </Link>
        </div>
      </section>
    </main>
  );
}

function TitleError({ type, onRetry }: { type?: string; onRetry: () => void }) {
  useMeta({ title: 'Something went wrong' });
  return (
    <ErrorCard
      message={`We couldn’t load this ${type === 'tv' ? 'show' : 'title'}. Try again, or head back home.`}
      onRetry={onRetry}
    />
  );
}

/** Anchor of the "Where to watch" section; `/title/:type/:id#where-to-watch` opens the page there. */
const WHERE_TO_WATCH = '#where-to-watch';

function scrollToWhereToWatch(reducedMotion: boolean) {
  const section = document.getElementById(WHERE_TO_WATCH.slice(1));
  if (!section) return false;
  section.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  return true;
}

function TitleView({ data }: { data: TitleDetails }) {
  const { movie, raw, cast, similar, trailer } = data;
  const reducedMotion = usePrefersReducedMotion();
  const { hash } = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { inList, toggle: toggleList } = useMyListToggle(movie, 'title');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { recordView } = useViewActions();
  const { toast } = useToast();
  const closeTrailer = useCallback(() => setTrailerOpen(false), []);

  useMeta({
    title: `${movie.title} (${movie.year})`,
    description: movie.description,
    image: movie.poster,
    type: movie.mediaType === 'tv' ? 'video.tv_show' : 'video.movie',
  });
  useEffect(() => {
    trackPage('title', { id: movie.id, mediaType: movie.mediaType });
  }, [movie.id, movie.mediaType, movie.title, movie.year]);

  // TitleView is keyed per title, so this runs once per title change (including Similar-card opens):
  // bring the new title into view and move focus to its heading so screen readers announce it.
  // Reduced motion is read once on mount on purpose; toggling it later must not re-scroll.
  // A #where-to-watch link (e.g. the Home hero) lands on that section instead of the top.
  const reducedMotionOnMount = useRef(reducedMotion);
  const hashOnMount = useRef(hash);
  useEffect(() => {
    const toWhereToWatch =
      hashOnMount.current === WHERE_TO_WATCH && scrollToWhereToWatch(reducedMotionOnMount.current);
    if (!toWhereToWatch && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: reducedMotionOnMount.current ? 'auto' : 'smooth' });
    }
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Track the open in viewing history (feeds Home's Continue Watching / Recently Viewed).
  // TitleView is keyed per title; the ref keeps StrictMode's double effect from counting twice.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    recordView(movie, 'open');
  }, [movie, recordView]);

  const runtime = formatRuntime(movie.runtime);
  const score =
    Number.isFinite(raw.vote_average) && raw.vote_average > 0 ? raw.vote_average.toFixed(1) : null;

  const onThumb = (thumb: Thumb | null) => {
    track(thumbEvent(thumb), { id: movie.id, mediaType: movie.mediaType, source: 'title' });
    if (thumb === 'up') toast(`Glad you liked ${movie.title}`, { kind: 'success' });
    else if (thumb === 'down') toast(`Got it — we’ll show fewer titles like ${movie.title}`);
    else toast(`Removed your thumb for ${movie.title}`);
  };

  const goToWhereToWatch = () => {
    scrollToWhereToWatch(reducedMotion);
    document.getElementById('title-wtw-heading')?.focus({ preventScroll: true });
  };

  const openTrailer = () => {
    track(AnalyticsEvents.playTrailer, {
      id: movie.id,
      mediaType: movie.mediaType,
      source: 'title',
    });
    recordView(movie, 'trailer');
    setTrailerOpen(true);
  };

  // Side effects only: MovieCard's <Link> performs the navigation. Calling navigate() here as well
  // would push the same /title entry twice (Back would need two presses).
  const openSimilar = (m: Movie) => {
    track(AnalyticsEvents.titleOpen, { id: m.id, mediaType: m.mediaType, source: 'similar' });
  };

  return (
    <main className="title-page">
      <TitleBackdrop src={movie.backdrop} />
      <div className="title-content">
        <article className="title-panel glass" aria-labelledby="title-heading">
          <p className="title-kind">{movie.mediaType === 'tv' ? 'Series' : 'Film'}</p>
          <h1 id="title-heading" ref={headingRef} tabIndex={-1}>
            {movie.title}
          </h1>
          <ul className="title-facts" aria-label="Details">
            <li className="fit">Fit {movie.match}</li>
            <li>{movie.year}</li>
            {runtime && (
              <li>
                <span className="title-sr-only">Runtime </span>
                {runtime}
                {movie.mediaType === 'tv' ? ' / ep' : ''}
              </li>
            )}
            {movie.rating && (
              <li>
                <span className="badge" title="Content rating">
                  {movie.rating}
                </span>
              </li>
            )}
            {score && (
              <li className="title-score" aria-label={`Audience score ${score} out of 10`}>
                <span aria-hidden>★</span> {score}
              </li>
            )}
          </ul>
          {movie.genres.length > 0 && (
            <ul className="title-genres" aria-label="Genres">
              {movie.genres.map((g) => (
                <li key={g} className="title-genre">
                  {g}
                </li>
              ))}
            </ul>
          )}
          <p className="title-overview">{movie.description || 'No overview available yet.'}</p>
          <div className="title-actions">
            <Button variant="primary" onClick={goToWhereToWatch}>
              Where to watch
            </Button>
            <Button
              variant="glass"
              onClick={openTrailer}
              disabled={!trailer}
              title={trailer ? undefined : 'No trailer available'}
            >
              {trailer ? 'Trailer' : 'No trailer'}
            </Button>
            <Button
              variant="glass"
              onClick={toggleList}
              aria-pressed={inList}
              className={inList ? 'is-listed' : undefined}
            >
              <span aria-hidden>{inList ? '✓' : '＋'}</span> My List
            </Button>
            <ThumbsControl
              titleId={movie.id}
              mediaType={movie.mediaType}
              title={movie.title}
              onChange={onThumb}
            />
            <RatingControl titleId={movie.id} title={movie.title} mediaType={movie.mediaType} />
          </div>
        </article>

        <CastStrip cast={cast} />

        <WhereToWatch mediaType={movie.mediaType} titleId={movie.id} title={movie.title} />

        {similar.length > 0 && (
          <div className="title-similar">
            <Row
              title={movie.mediaType === 'tv' ? 'More series like this' : 'More like this'}
              items={similar}
              onSelect={openSimilar}
            />
          </div>
        )}
      </div>

      {trailerOpen && trailer && (
        <TrailerModal
          video={trailer}
          title={movie.title}
          poster={movie.backdrop}
          onClose={closeTrailer}
          movie={movie}
          onThumbChange={onThumb}
        />
      )}
    </main>
  );
}

export default function TitlePage() {
  const { type, id } = useParams();
  const { state, retry } = useTitleDetails(type, id);

  if (state.status === 'loading') return <TitleSkeleton />;
  if (state.status === 'not-found') return <TitleNotFound type={type} id={id} />;
  if (state.status === 'error') return <TitleError type={type} onRetry={retry} />;
  return (
    <TitleView key={`${state.data.movie.mediaType}-${state.data.movie.id}`} data={state.data} />
  );
}
