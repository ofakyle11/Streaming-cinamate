import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Page from './Page';
import MovieCard from '../components/MovieCard';
import DetailModal from '../components/DetailModal';
import {
  analytics,
  tmdb,
  toMovie,
  type DiscoverSort,
  type Movie,
  type TmdbGenre,
} from '../services';

const SORTS: { value: DiscoverSort; label: string }[] = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'rating', label: 'Rating' },
  { value: 'date', label: 'Release date' },
];

interface Result {
  key: string;
  items: Movie[];
  totalPages: number;
  error: string | null;
}

export default function GenrePage() {
  const { id } = useParams();
  // Keyed so page/sort state resets when navigating between genres.
  return <GenreBrowse key={id} genreId={Number(id)} />;
}

function GenreBrowse({ genreId }: { genreId: number }) {
  const [genres, setGenres] = useState<TmdbGenre[] | null>(null);
  const [sortBy, setSortBy] = useState<DiscoverSort>('popularity');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<Movie | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmdb
      .genres()
      .then((g) => {
        if (!cancelled) setGenres(g);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!genres || !Number.isFinite(genreId)) return;
    let cancelled = false;
    const key = `${sortBy}:${page}`;
    analytics.page('genre');
    tmdb
      .discover({ genreId, page, sortBy })
      .then((res) => {
        if (cancelled) return;
        setResult({
          key,
          items: res.results.map((t) => toMovie(t, genres)),
          totalPages: Math.max(1, res.total_pages),
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const error = e instanceof Error ? e.message : 'Could not load this genre.';
        setResult({ key, items: [], totalPages: 1, error });
      });
    return () => {
      cancelled = true;
    };
  }, [genres, genreId, page, sortBy]);

  const current = result?.key === `${sortBy}:${page}` ? result : null;
  const items = current?.items ?? null;
  const error = current?.error ?? null;
  const totalPages = current?.totalPages ?? result?.totalPages ?? 1;

  const name = genres?.find((g) => g.id === genreId)?.name ?? (genres ? 'Unknown genre' : 'Genre');

  return (
    <Page title={name}>
      <div className="genre-toolbar">
        <label>
          Sort by{' '}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as DiscoverSort);
              setPage(1);
            }}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !items ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="muted">No titles in this genre yet.</p>
      ) : (
        <div className="genre-grid row in">
          {items.map((m, i) => (
            <MovieCard
              key={`${m.mediaType}-${m.id}`}
              movie={m}
              delay={i * 30}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}
      <nav className="pager" aria-label="Pagination">
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </nav>
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </Page>
  );
}
