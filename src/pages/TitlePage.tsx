import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Page from './Page';
import ErrorCard from '../components/errors/ErrorCard';
import { useMeta } from '../hooks/useMeta';
import { loadHomeCatalog, type Movie } from '../services';
import { withRetry } from '../services/retry';

export default function TitlePage() {
  const { type, id } = useParams();
  // undefined = loading, null = not found (distinct from a load failure).
  const [movie, setMovie] = useState<Movie | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    withRetry(() => loadHomeCatalog(), { maxAttempts: 3, signal: controller.signal })
      .then((c) => {
        const all = [...c.featured, ...c.rows.flatMap((r) => r.items)];
        if (cancelled) return;
        setFailed(false);
        setMovie(all.find((m) => String(m.id) === id) ?? null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, reloadKey]);
  useMeta({
    title: failed
      ? 'Something went wrong'
      : movie
        ? movie.title
        : movie === null
          ? 'Title not found'
          : 'Loading…',
    description: failed ? undefined : movie?.description,
    image: failed ? undefined : movie?.poster,
    type: type === 'tv' ? 'video.tv_show' : 'video.movie',
  });

  if (failed) {
    return (
      <ErrorCard
        message={`We couldn't load this ${type === 'tv' ? 'show' : 'title'}. Try again, or head back home.`}
        onRetry={() => {
          setFailed(false);
          setMovie(undefined);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }
  if (movie === undefined) {
    return (
      <Page title="Loading…">
        <p className="muted">Loading…</p>
      </Page>
    );
  }
  if (!movie) {
    return (
      <Page title="Title not found">
        <p className="muted">
          No {type ?? 'title'} with id {id}.
        </p>
        <Link className="page-link" to="/">
          Back home
        </Link>
      </Page>
    );
  }
  return (
    <Page title={movie.title}>
      <p className="muted">
        {movie.year} · {movie.rating} · {movie.genres.join(', ')} · {type}
      </p>
      <p>{movie.description}</p>
    </Page>
  );
}
