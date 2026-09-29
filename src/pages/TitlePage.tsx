import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Row from '../components/Row';
import CastStrip from '../components/title/CastStrip';
import RatingControl from '../components/title/RatingControl';
import TitleBackdrop from '../components/title/TitleBackdrop';
import TitleSkeleton from '../components/title/TitleSkeleton';
import TrailerModal from '../components/title/TrailerModal';
import WhereToWatch from '../components/title/WhereToWatch';
import '../components/title/title.css';
import { Button } from '../components/ui';
import { useViewActions } from '../hooks';
import { useMyListToggle } from '../hooks/useMyListToggle';
import { formatRuntime, useTitleDetails, type TitleDetails } from '../hooks/useTitleDetails';
import { analytics, type Movie } from '../services';

function TitleNotFound({ type, id }: { type?: string; id?: string }) {
  useEffect(() => {
    document.title = 'Title not found · Last Frame';
  }, []);
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

function TitleError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="title-page title-page-empty">
      <section className="title-state glass" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">{message}</p>
        <div className="title-actions">
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
          <Link className="btn glass" to="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}

function TitleView({ data }: { data: TitleDetails }) {
  const { movie, raw, cast, similar, trailer } = data;
  const navigate = useNavigate();
  const { inList, toggle: toggleList } = useMyListToggle(movie, 'title');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { recordView } = useViewActions();
  const closeTrailer = useCallback(() => setTrailerOpen(false), []);

  useEffect(() => {
    document.title = `${movie.title} (${movie.year}) · Last Frame`;
    analytics.page('title', { id: movie.id, mediaType: movie.mediaType });
  }, [movie.id, movie.mediaType, movie.title, movie.year]);

  // Track the open in viewing history (feeds Home's Continue Watching / Recently Viewed).
  // TitleView is keyed per title; the ref keeps StrictMode's double effect from counting twice.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    recordView(movie, 'open');
  }, [movie, recordView]);

  const runtime = formatRuntime(movie.runtime);
  const score = Number.isFinite(raw.vote_average) && raw.vote_average > 0 ? raw.vote_average.toFixed(1) : null;

  const openTrailer = () => {
    analytics.track('trailer_open', { id: movie.id, mediaType: movie.mediaType });
    recordView(movie, 'trailer');
    setTrailerOpen(true);
  };

  const openSimilar = (m: Movie) => {
    analytics.track('title_open', { id: m.id, mediaType: m.mediaType, source: 'similar' });
    navigate(`/title/${m.mediaType}/${m.id}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="title-page">
      <TitleBackdrop src={movie.backdrop} />
      <div className="title-content">
        <article className="title-panel glass" aria-labelledby="title-heading">
          <p className="title-kind">{movie.mediaType === 'tv' ? 'Series' : 'Film'}</p>
          <h1 id="title-heading">{movie.title}</h1>
          <ul className="title-facts" aria-label="Details">
            <li className="match">{movie.match}% Match</li>
            <li>{movie.year}</li>
            {runtime && (
              <li>
                <span className="title-sr-only">Runtime </span>
                {runtime}
                {movie.mediaType === 'tv' ? ' / ep' : ''}
              </li>
            )}
            <li>
              <span className="badge" title="Content rating">
                {movie.rating}
              </span>
            </li>
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
            <Button
              variant="primary"
              onClick={openTrailer}
              disabled={!trailer}
              title={trailer ? undefined : 'No trailer available'}
            >
              <span aria-hidden>▶</span> {trailer ? 'Play trailer' : 'No trailer'}
            </Button>
            <Button variant="glass" onClick={toggleList} aria-pressed={inList} className={inList ? 'is-listed' : undefined}>
              <span aria-hidden>{inList ? '✓' : '＋'}</span> My List
            </Button>
            <RatingControl titleId={movie.id} title={movie.title} />
          </div>
        </article>

        <CastStrip cast={cast} />

        <WhereToWatch mediaType={movie.mediaType} titleId={movie.id} title={movie.title} />

        {similar.length > 0 && (
          <div className="title-similar">
            <Row title={movie.mediaType === 'tv' ? 'More series like this' : 'More like this'} items={similar} onSelect={openSimilar} />
          </div>
        )}
      </div>

      {trailerOpen && trailer && (
        <TrailerModal video={trailer} title={movie.title} poster={movie.backdrop} onClose={closeTrailer} />
      )}
    </main>
  );
}

export default function TitlePage() {
  const { type, id } = useParams();
  const { state, retry } = useTitleDetails(type, id);

  if (state.status === 'loading') return <TitleSkeleton />;
  if (state.status === 'not-found') return <TitleNotFound type={type} id={id} />;
  if (state.status === 'error') return <TitleError message={state.message} onRetry={retry} />;
  return <TitleView key={`${state.data.movie.mediaType}-${state.data.movie.id}`} data={state.data} />;
}
