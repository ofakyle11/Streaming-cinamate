import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Page from './Page';
import type { MediaType, Movie } from '../services';
import { loadTitleDetails } from '../services/title';

export default function TitlePage() {
  const { type, id } = useParams();
  const [movie, setMovie] = useState<Movie | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadTitleDetails(type as MediaType, Number(id))
      .then((v) => v?.movie ?? null)
      .then((m) => {
        if (!cancelled) setMovie(m);
      })
      .catch(() => {
        if (!cancelled) setMovie(null);
      });
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (movie === undefined) {
    return <Page title="Loading…"><p className="muted">Loading…</p></Page>;
  }
  if (!movie) {
    return (
      <Page title="Title not found">
        <p className="muted">No {type ?? 'title'} with id {id}.</p>
        <Link className="page-link" to="/">Back home</Link>
      </Page>
    );
  }
  return (
    <Page title={movie.title}>
      <p className="muted">{movie.year} · {movie.rating} · {movie.genres.join(', ')} · {type}</p>
      <p>{movie.description}</p>
    </Page>
  );
}
