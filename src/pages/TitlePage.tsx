import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Page from './Page';
import { loadHomeCatalog, type Movie } from '../services';

export default function TitlePage() {
  const { type, id } = useParams();
  const [movie, setMovie] = useState<Movie | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadHomeCatalog()
      .then((c) => {
        const all = [...c.featured, ...c.rows.flatMap((r) => r.items)];
        if (!cancelled) setMovie(all.find((m) => String(m.id) === id) ?? null);
      })
      .catch(() => {
        if (!cancelled) setMovie(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
