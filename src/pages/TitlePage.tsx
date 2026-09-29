import { useParams, Link } from 'react-router-dom';
import Page from './Page';
import { movies } from '../data/movies';

export default function TitlePage() {
  const { type, id } = useParams();
  const movie = movies.find((m) => String(m.id) === id);
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
