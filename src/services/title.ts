/**
 * Title-detail data helper. Resolves `/title/:type/:id` through the active TMDB
 * adapter's `details()` (mock with no env vars, live via the proxy otherwise),
 * so every search / genre / New & Popular result has a detail record.
 */
import { tmdb, toMovie } from './index';
import type {
  MediaType,
  Movie,
  TmdbGenre,
  TmdbService,
  TmdbTitleDetails,
  TmdbVideo,
  TmdbWatchProvider,
} from './types';

export interface TitleCastMember {
  name: string;
  character: string;
  /** Fully qualified w185 profile image URL, or '' when TMDB has no photo. */
  profile: string;
}

export interface TitleView {
  movie: Movie;
  /** YouTube key of the best trailer, if any. */
  trailerKey?: string;
  /** First 12 billed cast members. */
  cast: TitleCastMember[];
  /** Recommendations (else similar), capped at 20. */
  similar: Movie[];
  /** Flatrate (subscription) providers for the requested region. */
  providers?: TmdbWatchProvider[];
}

const MAX_CAST = 12;
const MAX_SIMILAR = 20;

/** True when `type` is 'movie' | 'tv' and `id` is a positive safe integer. */
export function isValidTitleRef(type: unknown, id: unknown): type is MediaType {
  return (
    (type === 'movie' || type === 'tv') &&
    typeof id === 'number' &&
    Number.isSafeInteger(id) &&
    id > 0
  );
}

/** First official YouTube Trailer, else the first YouTube Teaser/Trailer. */
export function pickTrailerKey(videos: readonly TmdbVideo[] | undefined): string | undefined {
  const yt = (videos ?? []).filter((v) => v.site === 'YouTube' && v.key);
  const official = yt.find((v) => v.type === 'Trailer' && v.official);
  if (official) return official.key;
  return yt.find((v) => v.type === 'Trailer' || v.type === 'Teaser')?.key;
}

function mergeGenres(base: readonly TmdbGenre[], extra: readonly TmdbGenre[] | undefined): TmdbGenre[] {
  const seen = new Map<number, TmdbGenre>();
  for (const g of [...base, ...(extra ?? [])]) if (!seen.has(g.id)) seen.set(g.id, g);
  return [...seen.values()];
}

/** Maps a details record to the UI view model. Pure. */
export function toTitleView(
  d: TmdbTitleDetails,
  genres: readonly TmdbGenre[],
  svc: TmdbService = tmdb,
  region = 'US',
): TitleView {
  const allGenres = mergeGenres(genres, d.genres);
  const related = d.recommendations?.length ? d.recommendations : (d.similar ?? []);
  const cast = [...(d.credits?.cast ?? [])]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST)
    .map((c) => ({
      name: c.name,
      character: c.character,
      profile: c.profile_path ? svc.imageUrl(c.profile_path, 'w185') : '',
    }));
  const view: TitleView = {
    movie: toMovie(d, allGenres, svc),
    cast,
    similar: related.slice(0, MAX_SIMILAR).map((t) => toMovie(t, allGenres, svc)),
  };
  const trailerKey = pickTrailerKey(d.videos);
  if (trailerKey) view.trailerKey = trailerKey;
  const flatrate = d.watchProviders?.[region]?.flatrate;
  if (flatrate) view.providers = [...flatrate].sort((a, b) => a.display_priority - b.display_priority);
  return view;
}

/**
 * Loads a title's detail view through `svc.details()`. Resolves to null for an
 * invalid type/id or when the adapter has no such title.
 */
export async function loadTitleDetails(
  type: MediaType,
  id: number,
  svc: TmdbService = tmdb,
  region = 'US',
): Promise<TitleView | null> {
  if (!isValidTitleRef(type, id)) return null;
  const [details, genres] = await Promise.all([
    svc.details(type, id),
    svc.genres().catch((): TmdbGenre[] => []),
  ]);
  if (!details) return null;
  return toTitleView(details, genres, svc, region);
}
