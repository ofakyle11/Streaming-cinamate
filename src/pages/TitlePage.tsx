import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Page from './Page';
import Row from '../components/Row';
import { Button, Skeleton } from '../components/ui';
import { useIsInWatchlist, useRatingActions, useRatingFor, useWatchlistActions } from '../hooks';
import type { MediaType, Movie } from '../services';
import { loadTitle, type Region, type TitleExtras } from '../services/titleExtras';
import type { Rating } from '../state/store';
import '../styles/title.css';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ok'; movie: Movie; extras: TitleExtras };

function formatRuntime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function TitleSkeleton() {
  return (
    <main className="title-page" aria-busy="true" aria-label="Loading title">
      <div className="title-backdrop skeleton-bg" />
      <section className="title-panel glass">
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="80%" />
      </section>
    </main>
  );
}

function TrailerModal({ movie, url, onClose }: { movie: Movie; url: string | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="trailer-overlay" onClick={onClose}>
      <div
        className="trailer-modal glass"
        role="dialog"
        aria-modal="true"
        aria-label={`${movie.title} trailer`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} className="trailer-close" onClick={onClose} aria-label="Close trailer">
          ×
        </button>
        {url ? (
          <div className="trailer-frame">
            <img src={url} alt="" />
            <span className="trailer-note">Trailer preview (mock)</span>
          </div>
        ) : (
          <p className="muted">No trailer available for {movie.title}.</p>
        )}
      </div>
    </div>
  );
}

function RateControl({ titleId }: { titleId: number }) {
  const current = useRatingFor(titleId);
  const { rate, clear } = useRatingActions();
  return (
    <div className="rate" role="group" aria-label="Rate this title">
      {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
        <button
          key={n}
          className={`star ${current && n <= current ? 'on' : ''}`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={current === n}
          onClick={() => (current === n ? clear(titleId) : rate(titleId, n))}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function TitlePage() {
  const { type, id } = useParams();
  return <TitleView key={`${type}/${id}`} type={type} id={id} />;
}

function TitleView({ type, id }: { type?: string; id?: string }) {
  const navigate = useNavigate();
  const numId = Number(id);
  const mediaType: MediaType | null = type === 'movie' || type === 'tv' ? type : null;
  const valid = Boolean(mediaType) && Number.isFinite(numId);
  const [state, setState] = useState<State>(valid ? { status: 'loading' } : { status: 'missing' });
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [region, setRegion] = useState<Region>('US');
  const [bgLoaded, setBgLoaded] = useState(false);
  const inList = useIsInWatchlist(numId);
  const { toggle } = useWatchlistActions();

  useEffect(() => {
    let cancelled = false;
    if (!mediaType || !valid) return;
    loadTitle(mediaType, numId)
      .then((r) => {
        if (!cancelled) setState(r ? { status: 'ok', ...r } : { status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, numId, valid]);

  if (state.status === 'loading') return <TitleSkeleton />;
  if (state.status === 'missing') {
    return (
      <Page title="Title not found">
        <p className="muted">We couldn’t find that {type === 'tv' ? 'show' : 'title'}.</p>
        <Link className="page-link" to="/">Back home</Link>
      </Page>
    );
  }

  const { movie, extras } = state;
  const providers = extras.providers[region];

  return (
    <main className="title-page">
      <div className={`title-backdrop ${bgLoaded ? 'loaded' : ''}`}>
        <img src={movie.backdrop} alt="" onLoad={() => setBgLoaded(true)} />
      </div>

      <section className="title-panel glass">
        <h1>{movie.title}</h1>
        <p className="title-meta">
          <span>{movie.year}</span>
          <span>{formatRuntime(movie.runtime)}</span>
          <span className="cert">{movie.rating}</span>
          <span>{movie.genres.join(' · ')}</span>
        </p>
        <p className="title-overview">{movie.description}</p>
        <div className="title-actions">
          <Button variant="primary" onClick={() => setTrailerOpen(true)}>▶ Play trailer</Button>
          <Button variant="glass" aria-pressed={inList} onClick={() => toggle(movie.id)}>
            {inList ? '✓ In My List' : '+ My List'}
          </Button>
          <RateControl titleId={movie.id} />
        </div>
      </section>

      <section className="title-section">
        <h2>Cast</h2>
        <ul className="cast-strip">
          {extras.cast.map((c) => (
            <li key={c.id} className="cast-card glass">
              <img src={c.photo} alt="" loading="lazy" />
              <strong>{c.name}</strong>
              <span className="muted">{c.character}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="title-section glass providers">
        <div className="providers-head">
          <h2>Where to watch</h2>
          <div className="region-toggle" role="group" aria-label="Region">
            {(['US', 'CA'] as Region[]).map((r) => (
              <button key={r} className={r === region ? 'on' : ''} aria-pressed={r === region} onClick={() => setRegion(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {providers.length ? (
          <ul className="provider-list">
            {providers.map((p) => (
              <li key={`${p.id}-${p.kind}`}>
                <strong>{p.name}</strong> <span className="muted">{p.kind}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Not currently available in {region === 'US' ? 'the US' : 'Canada'}.</p>
        )}
        <p className="attribution muted">
          Availability data provided by{' '}
          <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a>.
        </p>
      </section>

      {extras.similar.length > 0 && (
        <Row title="More like this" items={extras.similar} onSelect={(m) => navigate(`/title/${m.mediaType}/${m.id}`)} />
      )}

      {trailerOpen && <TrailerModal movie={movie} url={extras.trailerUrl} onClose={() => setTrailerOpen(false)} />}
    </main>
  );
}
