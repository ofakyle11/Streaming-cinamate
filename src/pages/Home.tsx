import { Fragment, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import HeroSkeleton from '../components/HeroSkeleton';
import HistoryRows from '../components/HistoryRows';
import Row from '../components/Row';
import GenreChips from '../components/GenreChips';
import RowSkeleton from '../components/RowSkeleton';
import RowError from '../components/RowError';
import ErrorCard from '../components/errors/ErrorCard';
import { tmdb, type Movie, type TmdbService } from '../services';
import { AnalyticsEvents, track, trackPage } from '../services/analytics/track';
import { useHomeRows } from '../hooks/useHomeRows';
import { useBecauseYouLiked } from '../hooks/useBecauseYouLiked';
import { useMeta } from '../hooks/useMeta';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { HERO_ROW_ID, titlePath } from './homeRows';
import '../styles/home.css';

interface Props {
  /** TMDB adapter override (tests). Defaults to the active mock/live adapter. */
  svc?: TmdbService;
}

export default function Home({ svc = tmdb }: Props) {
  const navigate = useNavigate();
  const { rows, featured, heroStatus, allFailed, retry, retryAll } = useHomeRows(svc);
  const likedRows = useBecauseYouLiked(svc);
  const online = useOnlineStatus();
  useMeta();

  useEffect(() => {
    trackPage('home');
  }, []);

  const trackOpen = useCallback((m: Movie) => {
    track(AnalyticsEvents.titleOpen, { id: m.id, mediaType: m.mediaType, source: 'home' });
  }, []);

  /** "Where to watch" lands on that section of the title page. */
  const openFromHero = useCallback(
    (m: Movie) => {
      trackOpen(m);
      navigate(`${titlePath(m)}#where-to-watch`, { viewTransition: true });
    },
    [navigate, trackOpen],
  );

  /** Trailer fallback (no trailer available): the plain title page. */
  const openTitleFromHero = useCallback(
    (m: Movie) => {
      trackOpen(m);
      navigate(titlePath(m), { viewTransition: true });
    },
    [navigate, trackOpen],
  );

  if (allFailed) {
    // ErrorCard renders its own <main>, so it replaces (not nests in) Home's.
    return (
      <ErrorCard
        title="We couldn’t load the catalogue"
        message={
          online
            ? 'The catalogue failed to load. Check your connection and try again.'
            : 'You appear to be offline. Reconnect and try again.'
        }
        onRetry={retryAll}
        showHome={false}
      />
    );
  }

  const hasHero = heroStatus !== 'error';

  // "Because you liked X" rows sit right after the hero row (or first, if it is missing).
  const likedAfter = rows.some((r) => r.id === HERO_ROW_ID) ? HERO_ROW_ID : null;
  const liked = likedRows.map((r) => (
    <Row key={r.id} title={r.title} items={r.items} onSelect={trackOpen} />
  ));

  return (
    // One <main> landmark holds the Hero (and its page <h1>) and the rows.
    <main className="home">
      {featured ? (
        <Hero featured={featured} onMore={openFromHero} onOpenTitle={openTitleFromHero} />
      ) : (
        heroStatus === 'loading' && <HeroSkeleton />
      )}
      <div className={`rows home-rows${hasHero ? '' : ' no-hero'}`}>
        <HistoryRows onSelect={trackOpen} />
        {likedAfter === null && liked}
        {rows.map(({ id, title, state }) => {
          let row;
          if (state.status === 'loading') row = <RowSkeleton title={title} />;
          else if (state.status === 'error') {
            row = <RowError title={title} message={state.message} onRetry={() => retry(id)} />;
          } else if (state.items.length > 0)
            row = <Row title={title} items={state.items} onSelect={trackOpen} />;
          return (
            <Fragment key={id}>
              {row}
              {id === likedAfter && liked}
            </Fragment>
          );
        })}
        <GenreChips />
      </div>
    </main>
  );
}
