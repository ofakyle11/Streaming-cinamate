import { Fragment, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import HeroSkeleton from '../components/HeroSkeleton';
import HistoryRows from '../components/HistoryRows';
import Row from '../components/Row';
import RowSkeleton from '../components/RowSkeleton';
import RowError from '../components/RowError';
import { Button } from '../components/ui';
import { analytics, tmdb, type Movie, type TmdbService } from '../services';
import { useHomeRows } from '../hooks/useHomeRows';
import { useBecauseYouLiked } from '../hooks/useBecauseYouLiked';
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

  useEffect(() => {
    analytics.page('home');
  }, []);

  const track = useCallback((m: Movie) => {
    analytics.track('title_open', { id: m.id, mediaType: m.mediaType });
  }, []);

  const openFromHero = useCallback(
    (m: Movie) => {
      track(m);
      navigate(titlePath(m));
    },
    [navigate, track],
  );

  if (allFailed) {
    return (
      <main className="rows home-rows no-hero">
        <div className="home-error glass" role="alert">
          <h1>We couldn’t load the catalogue</h1>
          <p>Check your connection and try again.</p>
          <Button variant="primary" onClick={retryAll}>
            ↻ Try again
          </Button>
        </div>
      </main>
    );
  }

  const hasHero = heroStatus !== 'error';

  // "Because you liked X" rows sit right after the hero row (or first, if it is missing).
  const likedAfter = rows.some((r) => r.id === HERO_ROW_ID) ? HERO_ROW_ID : null;
  const liked = likedRows.map((r) => <Row key={r.id} title={r.title} items={r.items} onSelect={track} />);

  return (
    <>
      {featured ? <Hero featured={featured} onMore={openFromHero} /> : heroStatus === 'loading' && <HeroSkeleton />}
      <main className={`rows home-rows${hasHero ? '' : ' no-hero'}`}>
        <HistoryRows onSelect={track} />
        {likedAfter === null && liked}
        {rows.map(({ id, title, state }) => {
          let row;
          if (state.status === 'loading') row = <RowSkeleton title={title} />;
          else if (state.status === 'error') {
            row = <RowError title={title} message={state.message} onRetry={() => retry(id)} />;
          } else if (state.items.length > 0) row = <Row title={title} items={state.items} onSelect={track} />;
          return (
            <Fragment key={id}>
              {row}
              {id === likedAfter && liked}
            </Fragment>
          );
        })}
      </main>
    </>
  );
}
