import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { imageOrPlaceholder, tmdb, type Movie, type TmdbService } from '../services';
import { AnalyticsEvents, track, trackPage } from '../services/analytics/track';
import { useLandingWall, WALL_COUNT } from '../hooks/useLandingWall';
import { useMeta } from '../hooks/useMeta';
import { rememberGuest } from '../lib/guest';
import '../styles/landing.css';

export const LANDING_TITLE = 'Find where to watch';
export const LANDING_DESCRIPTION =
  'Lastframe.tv finds where any film or series is streaming tonight, scores how well it fits your taste, and keeps your list in sync on every device.';
/** Share card for the front door (1200 x 630, public/og-landing.png). */
export const LANDING_IMAGE = '/og-landing.png';

/** Tile tints while a poster loads (and for good when it never does): the avatar gradients, all tokens. */
const TINTS = [
  '--avatar-nebula',
  '--avatar-lagoon',
  '--avatar-dusk',
  '--avatar-meadow',
  '--avatar-gold',
  '--avatar-aurora',
  '--avatar-rose',
  '--avatar-ember',
  '--avatar-nebula',
] as const;

/** Stagger index for the `.lf-rise` load choreography (motion.css). */
const rise = (i: number) => ({ '--i': i }) as CSSProperties;

interface Props {
  /** Catalogue adapter override (tests). Defaults to the active mock/live adapter. */
  svc?: TmdbService;
}

function Poster({ movie, index }: { movie: Movie | null; index: number }) {
  const [loaded, setLoaded] = useState(false);
  // The rise staggers by row (motion.css documents --i 0..4); columns arrive together.
  const style = {
    '--pg': `var(${TINTS[index % TINTS.length]})`,
    '--i': Math.floor(index / 3),
  } as CSSProperties;
  return (
    <figure className={`land-poster lf-rise${loaded ? ' is-loaded' : ''}`} style={style}>
      {movie ? (
        <>
          <img
            src={imageOrPlaceholder(movie.poster)}
            alt=""
            decoding="async"
            // Tiles 7 to 9 are hidden on phones (landing.css): lazy so they are not fetched there.
            loading={index >= 6 ? 'lazy' : undefined}
            onLoad={() => setLoaded(true)}
          />
          <span className="land-poster-fit mono">Fit {movie.match}</span>
          <figcaption className="land-poster-title">{movie.title}</figcaption>
        </>
      ) : null}
    </figure>
  );
}

/**
 * The front door for signed-out first-time visitors (next-phase plan, T1):
 * an Ink hero with a tilted poster wall from the catalogue, three value cards,
 * three steps and a closing call to action. "Browse as a guest" is remembered
 * on this device and `/` then opens the app (see FrontDoor).
 */
export default function LandingPage({ svc = tmdb }: Props) {
  const navigate = useNavigate();
  const wall = useLandingWall(svc);
  useMeta({
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    image: LANDING_IMAGE,
    largeImage: true,
  });

  useEffect(() => {
    trackPage('landing');
  }, []);

  const browseAsGuest = useCallback(() => {
    track(AnalyticsEvents.browseAsGuest, { source: 'landing' });
    rememberGuest();
    // Replace, not push: `/` is already the current entry, so Back still leaves the site.
    navigate('/', { replace: true, viewTransition: true });
  }, [navigate]);

  const tiles = Array.from({ length: WALL_COUNT }, (_, i) => wall.items[i] ?? null);

  return (
    <main className="landing">
      <section className="land-hero">
        <div className="land-screen">
          <div className="land-sweep" aria-hidden="true" />
          <div className="land-copy">
            <p className="land-eyebrow mono lf-rise" style={rise(0)}>
              Film &amp; TV discovery
            </p>
            <h1 className="lf-rise" style={rise(1)}>
              Know where it streams <em>before you go looking.</em>
            </h1>
            <p className="land-lead lf-rise" style={rise(2)}>
              Lastframe.tv finds where any film or series is available tonight, scores how well it
              fits your taste, and keeps your list in sync on every device.
            </p>
            <div className="land-cta lf-rise" style={rise(3)}>
              <Link className="btn accent lg" to="/sign-in?new=1">
                Get started, it’s free
              </Link>
              <button type="button" className="btn glass lg land-guest" onClick={browseAsGuest}>
                Browse as a guest
              </button>
            </div>
            <p className="land-note lf-rise" style={rise(4)}>
              No password. We email you a sign-in link. Your list stays on this device until you
              sign in.
            </p>
          </div>
          <div
            className={`land-wall is-${wall.status}`}
            aria-hidden="true"
            data-testid="landing-wall"
          >
            {tiles.map((m, i) => (
              // Keyed by slot so a tile never remounts (and re-runs its entrance) when its title arrives.
              <Poster key={`tile-${i}`} movie={m} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="land-section container" aria-labelledby="land-what">
        <p className="land-eyebrow mono">What it does</p>
        <h2 id="land-what">Three answers, one place.</h2>
        <p className="land-section-lead">
          Every title page answers the questions you actually have before you commit an evening.
        </p>
        <ul className="land-values">
          <li className="land-value">
            <span className="land-value-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </span>
            <h3>Where to watch</h3>
            <p>
              Streaming, rent and buy offers for your region, updated daily, with a direct link to
              the service.
            </p>
            <div className="land-demo">
              <span className="land-chips" aria-hidden="true">
                <span className="land-chip is-on">Included</span>
                <span className="land-chip">Rent</span>
                <span className="land-chip">Buy</span>
              </span>
              <span>Included with 2 of your services</span>
            </div>
          </li>
          <li className="land-value">
            <span className="land-value-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <h3>Fit score</h3>
            <p>
              A 0 to 100 score from what you have rated and saved. It is honest when something is
              not for you.
            </p>
            <div className="land-demo">
              <span className="land-fitbar" aria-hidden="true">
                <i style={{ width: '82%' }} />
              </span>
              <b>Fit 82</b>
            </div>
          </li>
          <li className="land-value">
            <span className="land-value-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 8h13l-3-3M20 16H7l3 3" />
              </svg>
            </span>
            <h3>My List, everywhere</h3>
            <p>
              Sign in once and your list, history and ratings follow you from phone to TV to laptop.
            </p>
            <div className="land-demo">
              <span className="land-dot" aria-hidden="true" />
              <span>Synced across 3 devices</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="land-section container" aria-labelledby="land-how">
        <p className="land-eyebrow mono">How it works</p>
        <h2 id="land-how">Set up in under a minute.</h2>
        <ol className="land-steps">
          <li className="land-step">
            <span className="land-step-n mono">Step 1</span>
            <h3>Pick your services</h3>
            <p>
              Tell us which streaming services you already pay for. Offers you can watch tonight
              come first.
            </p>
          </li>
          <li className="land-step">
            <span className="land-step-n mono">Step 2</span>
            <h3>Rate a few titles</h3>
            <p>Thumbs on a handful of films you know teaches the fit score what you like.</p>
          </li>
          <li className="land-step">
            <span className="land-step-n mono">Step 3</span>
            <h3>Save and go</h3>
            <p>Add to My List from anywhere. Open the app on the TV and it is already there.</p>
          </li>
        </ol>
      </section>

      <section className="land-final container" aria-labelledby="land-final">
        <div className="land-final-card">
          <h2 id="land-final">Stop scrolling. Start watching.</h2>
          <p>Free to use. No ads in your list. Delete your data any time.</p>
          <Link className="btn accent lg" to="/sign-in?new=1">
            Create your account
          </Link>
        </div>
      </section>
    </main>
  );
}
