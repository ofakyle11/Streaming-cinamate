import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import HeroSkeleton from '../components/HeroSkeleton';
import Row from '../components/Row';
import RowSkeleton from '../components/RowSkeleton';
import RowError from '../components/RowError';
import { Button } from '../components/ui';
import { analytics, tmdb, type Movie, type TmdbService } from '../services';
import { useHomeRows } from '../hooks/useHomeRows';
import { titlePath } from './homeRows';
import '../styles/home.css';

interface Props {
  /** TMDB adapter override (tests). Defaults to the active mock/live adapter. */
  svc?: TmdbService;
}

export default function Home({ svc = tmdb }: Props) {
  const navigate = useNavigate();
  const { rows, featured, heroStatus, allFailed, retry, retryAll } = useHomeRows(svc);

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

  return (
    <>
      {featured ? <Hero featured={featured} onMore={openFromHero} /> : heroStatus === 'loading' && <HeroSkeleton />}
      <main className={`rows home-rows${hasHero ? '' : ' no-hero'}`}>
        {rows.map(({ id, title, state }) => {
          if (state.status === 'loading') return <RowSkeleton key={id} title={title} />;
          if (state.status === 'error') {
            return <RowError key={id} title={title} message={state.message} onRetry={() => retry(id)} />;
          }
          if (state.items.length === 0) return null;
          return <Row key={id} title={title} items={state.items} onSelect={track} />;
        })}
      </main>
    </>
  );
}
