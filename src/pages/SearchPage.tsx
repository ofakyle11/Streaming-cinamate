import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Page from './Page';
import MovieCard from '../components/MovieCard';
import DetailModal from '../components/DetailModal';
import { analytics, tmdb, toMovie, type MediaType, type Movie, type TmdbGenre } from '../services';

const DEBOUNCE_MS = 300;
const TYPES: { value: MediaType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Films' },
  { value: 'tv', label: 'Series' },
];
const MIN_RATINGS = [0, 6, 7, 8];

interface Results {
  key: string;
  items: Movie[];
  page: number;
  totalPages: number;
  error: string | null;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [input, setInput] = useState(urlQuery);
  const [type, setType] = useState<MediaType | 'all'>('all');
  const [genreId, setGenreId] = useState<number | null>(null);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [genres, setGenres] = useState<TmdbGenre[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Movie | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Keep the input in sync when the navbar search changes ?q= (adjust state during render).
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setInput(urlQuery);
  }

  // Debounce typing into the URL (the URL is the source of truth for the query).
  useEffect(() => {
    if (input === urlQuery) return;
    const t = setTimeout(() => {
      setParams(input.trim() ? { q: input.trim() } : {}, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input, urlQuery, setParams]);

  useEffect(() => {
    tmdb.genres().then(setGenres).catch(() => setGenres([]));
  }, []);

  const query = urlQuery.trim();
  const key = `${query}|${type}`;

  // First page whenever the query or type changes.
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    analytics.track('search', { query });
    tmdb
      .search(query, 1, type === 'all' ? {} : { mediaType: type })
      .then((res) => {
        if (cancelled) return;
        setResults({
          key,
          items: res.results.map((t) => toMovie(t, genres)),
          page: 1,
          totalPages: Math.max(1, res.total_pages),
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResults({ key, items: [], page: 1, totalPages: 1, error: e instanceof Error ? e.message : 'Search failed.' });
      });
    return () => {
      cancelled = true;
    };
  }, [query, type, key, genres]);

  const current = query && results?.key === key ? results : null;

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !current || current.error || current.page >= current.totalPages) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        const next = current.page + 1;
        tmdb
          .search(query, next, type === 'all' ? {} : { mediaType: type })
          .then((res) => {
            setResults((prev) =>
              prev && prev.key === key
                ? { ...prev, items: [...prev.items, ...res.results.map((t) => toMovie(t, genres))], page: next }
                : prev,
            );
          })
          .catch(() => {
            /* keep what we have; the user can scroll again to retry */
          })
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [current, query, type, key, genres, loadingMore]);

  // Genre, year and rating filters apply to the loaded results.
  const visible = useMemo(() => {
    if (!current) return [];
    const genreName = genres.find((g) => g.id === genreId)?.name;
    const from = Number(yearFrom) || 0;
    const to = Number(yearTo) || 9999;
    return current.items.filter(
      (m) =>
        (!genreName || m.genres.includes(genreName)) &&
        m.year >= from &&
        m.year <= to &&
        m.match / 10 >= minRating,
    );
  }, [current, genres, genreId, yearFrom, yearTo, minRating]);

  return (
    <Page title="Search">
      <div className="search-page">
        <input
          className="search-input glass"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search films and series"
          aria-label="Search films and series"
          autoFocus
        />

        <div className="search-filters" role="group" aria-label="Filters">
          {TYPES.map((t) => (
            <button
              key={t.value}
              className={`chip glass ${type === t.value ? 'active' : ''}`}
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
          <select className="chip glass" value={genreId ?? ''} onChange={(e) => setGenreId(e.target.value ? Number(e.target.value) : null)} aria-label="Genre">
            <option value="">Any genre</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input className="chip glass year" inputMode="numeric" placeholder="From year" value={yearFrom} onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="From year" />
          <input className="chip glass year" inputMode="numeric" placeholder="To year" value={yearTo} onChange={(e) => setYearTo(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="To year" />
          <select className="chip glass" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} aria-label="Minimum rating">
            {MIN_RATINGS.map((r) => (
              <option key={r} value={r}>
                {r ? `${r}+ rating` : 'Any rating'}
              </option>
            ))}
          </select>
        </div>

        {!query ? (
          <p className="muted">Type to search titles.</p>
        ) : !current ? (
          <p className="muted" role="status">Searching…</p>
        ) : current.error ? (
          <div role="alert" className="search-error">
            <p>{current.error}</p>
            <button className="btn glass" onClick={() => setResults(null)}>Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <p className="muted">No results for “{query}”. Try another title or loosen the filters.</p>
        ) : (
          <div className="genre-grid row in">
            {visible.map((m, i) => (
              <MovieCard key={`${m.mediaType}-${m.id}`} movie={m} delay={(i % 20) * 30} onSelect={setSelected} />
            ))}
          </div>
        )}
        <div ref={sentinel} aria-hidden />
        {loadingMore && <p className="muted" role="status">Loading more…</p>}
      </div>
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </Page>
  );
}
