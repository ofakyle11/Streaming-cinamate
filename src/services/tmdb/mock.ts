import type {
  MediaType,
  TmdbCastMember,
  TmdbGenre,
  TmdbImageSize,
  TmdbPage,
  TmdbService,
  TmdbTitle,
  TmdbTitleDetails,
  TmdbVideo,
  TmdbWatchProvider,
  TmdbWatchProviders,
  WatchRegion,
} from '../types';
import { sortTitles } from './sort';

/** Real TMDB genre ids so the mock is drop-in compatible with live data. */
export const MOCK_GENRES: TmdbGenre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

const CERTS_MOVIE = ['PG', 'PG-13', 'R', 'PG-13', 'R'];
const CERTS_TV = ['TV-14', 'TV-MA', 'TV-PG', 'TV-MA'];

interface Seed {
  t: string;
  g: number[];
  type: MediaType;
  o: string;
}

/** 60 fictional titles. Every name is invented for Last Frame. */
const SEEDS: Seed[] = [
  { t: 'Neon Drift', g: [878, 28], type: 'movie', o: 'A courier in a rain-soaked megacity discovers the package she is carrying is a copy of her own memories.' },
  { t: 'The Glass Horizon', g: [18, 9648], type: 'movie', o: 'Two estranged sisters reunite at a coastal observatory to settle their late father’s unfinished experiment.' },
  { t: 'Midnight Protocol', g: [53, 80], type: 'tv', o: 'A night-shift dispatcher uncovers a pattern in the calls no one else is meant to hear.' },
  { t: 'Echoes of Aurora', g: [878, 18], type: 'movie', o: 'An arctic research team receives a transmission that predates the station itself.' },
  { t: 'Silent Orbit', g: [878, 53], type: 'movie', o: 'The last crew member awake on a deep-space freighter must decide who to trust: the ship or herself.' },
  { t: 'Crimson Tide Line', g: [28, 12], type: 'movie', o: 'A retired salvage diver is pulled back for one final descent to a wreck that should not exist.' },
  { t: 'Paper Kingdoms', g: [16, 10751], type: 'movie', o: 'A girl folds a paper city that comes alive every night while the real one sleeps.' },
  { t: 'Velvet Static', g: [18, 10749], type: 'tv', o: 'A pirate radio DJ and a sound engineer fall in love across a frequency neither of them should be using.' },
  { t: 'Last Light Express', g: [12, 14], type: 'movie', o: 'A train that runs only at dusk carries passengers to the one place they never said goodbye.' },
  { t: 'Hollow Summit', g: [27, 9648], type: 'movie', o: 'Climbers stranded at a mountain hut realise the storm outside is not the thing keeping them there.' },
  { t: 'Signal Lost', g: [53, 878], type: 'tv', o: 'When every satellite goes dark at once, a small-town technician becomes the world’s only link.' },
  { t: 'Chrome Hearts', g: [28, 80], type: 'movie', o: 'A getaway driver with a failing heart takes one last job to buy a replacement she cannot afford.' },
  { t: 'The Quiet Coast', g: [18], type: 'movie', o: 'A lighthouse keeper’s final season becomes a meditation on what we choose to keep lit.' },
  { t: 'Parallax', g: [878, 9648], type: 'tv', o: 'Two detectives investigate the same crime in cities that exist one second apart.' },
  { t: 'Ember & Ash', g: [14, 12], type: 'movie', o: 'Twin fire-mages split by war must rekindle the one flame that can end it.' },
  { t: 'Northbound', g: [18, 12], type: 'movie', o: 'A road trip to scatter a mother’s ashes turns into a reckoning with the family she left behind.' },
  { t: 'Liquid Sky', g: [878, 16], type: 'movie', o: 'In a city where the sky is an ocean, a diver-pilot hunts the storm that swallowed her brother.' },
  { t: 'The Cartographer', g: [36, 12], type: 'tv', o: 'A 17th-century mapmaker charts a coastline that keeps rearranging itself overnight.' },
  { t: 'Afterglow', g: [10749, 18], type: 'movie', o: 'Two strangers keep meeting in the golden hour after their respective breakups.' },
  { t: 'Prism Break', g: [28, 878], type: 'movie', o: 'A heist crew steals light itself from a corporation that has privatised the sun.' },
  { t: 'Deep Field', g: [99], type: 'movie', o: 'Astronomers race to capture the faintest galaxy ever observed before the telescope is decommissioned.' },
  { t: 'Wild Frequencies', g: [35, 12], type: 'tv', o: 'A washed-up radio host takes a gig narrating nature documentaries and accidentally becomes a cult hit.' },
  { t: 'Saltwater Saints', g: [18, 80], type: 'tv', o: 'A fishing town’s harbour master is quietly running the most honest smuggling ring on the coast.' },
  { t: 'Low Tide', g: [53, 18], type: 'movie', o: 'A marine biologist returns home to find the bay drained and her childhood friend missing.' },
  { t: 'Kinetic', g: [28, 53], type: 'movie', o: 'A parkour messenger has ninety minutes to cross a locked-down city before the vaccine spoils.' },
  { t: 'Starlit Run', g: [12, 10751], type: 'movie', o: 'A boy and his robotic dog race across a desert to return a fallen star to the sky.' },
  { t: 'Glasshouse', g: [9648, 53], type: 'tv', o: 'Guests at a transparent hotel realise every room is being watched, and the watchers are also guests.' },
  { t: 'Fault Lines', g: [18, 36], type: 'tv', o: 'Three generations of a family live through the earthquake that redrew their city.' },
  { t: 'Overcast', g: [18, 10749], type: 'movie', o: 'A weather forecaster who has never been wrong predicts the day she will fall in love.' },
  { t: 'Momentum', g: [28], type: 'movie', o: 'A stunt driver framed for a fatal crash must outrun the studio that set her up.' },
  { t: 'Hushed Meridian', g: [878, 18], type: 'movie', o: 'On a planet where sound kills, a linguist learns to speak with her hands, and then with her mind.' },
  { t: 'The Lantern Ward', g: [14, 10751], type: 'tv', o: 'Apprentice lamp-lighters guard a city from the dark that gathers between streetlights.' },
  { t: 'Ninety Fathoms', g: [53, 27], type: 'movie', o: 'A submarine rescue crew descends to a vessel whose crew insist they were never in trouble.' },
  { t: 'Sundown Circuit', g: [28, 37], type: 'tv', o: 'A bounty hunter on motorbike crosses the last lawless stretch of a modern frontier.' },
  { t: 'Marginalia', g: [9648, 18], type: 'movie', o: 'A rare-book restorer finds notes in the margins addressed to her, written a century ago.' },
  { t: 'Coldwater Kings', g: [80, 18], type: 'tv', o: 'Two brothers inherit a failing ice-fishing empire and the debts that come with it.' },
  { t: 'Bright Static', g: [35, 10749], type: 'movie', o: 'A failing TV repair shop becomes a matchmaking service when the sets start showing the future.' },
  { t: 'The Understudy', g: [18, 53], type: 'movie', o: 'An understudy gets her chance when the lead vanishes, and then the script begins to change.' },
  { t: 'Orbital Drift', g: [878, 12], type: 'tv', o: 'A salvage family scours dead satellites for parts while a corporation hunts them for the same.' },
  { t: 'Wren & Hollow', g: [16, 12], type: 'movie', o: 'A wren with no song and a hollow tree with no roots set out to find where the forest ends.' },
  { t: 'Terminal Velocity Club', g: [28, 35], type: 'movie', o: 'Retired skydivers reunite for a heist that can only be pulled off in freefall.' },
  { t: 'Aperture', g: [53, 9648], type: 'tv', o: 'A wedding photographer notices the same stranger in every album she has ever shot.' },
  { t: 'The Salt Road', g: [36, 18], type: 'movie', o: 'A caravan guide leads refugees across an ancient trade route as an empire collapses behind them.' },
  { t: 'Noctiluca', g: [14, 10749], type: 'movie', o: 'On a beach that glows once a decade, a woman meets the man she will forget by morning.' },
  { t: 'Half-Life Radio', g: [878, 18], type: 'tv', o: 'Survivors in a bunker keep a broadcast alive for listeners who may not exist.' },
  { t: 'Blueprint for Rain', g: [99], type: 'movie', o: 'Engineers in a drought-struck valley attempt to build the first working cloud machine.' },
  { t: 'Vantage', g: [28, 53], type: 'movie', o: 'A sniper turned bodyguard protects a witness inside a skyscraper with no exits.' },
  { t: 'Dear Nobody', g: [10749, 35], type: 'tv', o: 'An advice columnist starts answering letters from someone who knows too much about her.' },
  { t: 'Iron Orchard', g: [10752, 18], type: 'movie', o: 'A field medic tends an orchard between battles, and it becomes the reason both sides stop.' },
  { t: 'The Tally', g: [80, 53], type: 'tv', o: 'A forensic accountant realises every fraud she has uncovered is one ledger in a larger book.' },
  { t: 'Foxfire Lane', g: [10751, 14], type: 'movie', o: 'Siblings discover the cul-de-sac they grew up on rearranges itself when no adult is looking.' },
  { t: 'Zero Hour Bakery', g: [35, 18], type: 'tv', o: 'A night bakery becomes the unofficial confession booth for a sleepless city.' },
  { t: 'Antumbra', g: [878, 27], type: 'movie', o: 'During a total eclipse, a town’s shadows stop following their owners.' },
  { t: 'Headwaters', g: [12, 99], type: 'movie', o: 'A canoeist traces a river to its source and the people who have kept it secret.' },
  { t: 'Second Skin', g: [53, 878], type: 'movie', o: 'A prosthetics designer discovers her newest implant is transmitting to someone else.' },
  { t: 'Long Exposure', g: [18, 10749], type: 'movie', o: 'A street photographer and a night nurse share the same city at opposite hours until one of them switches.' },
  { t: 'Cinder Court', g: [14, 28], type: 'tv', o: 'In a kingdom lit by a dying volcano, a smith’s daughter forges the blade that could relight it.' },
  { t: 'Groundswell', g: [18, 35], type: 'movie', o: 'A surf-town mayor bets the whole budget on a wave that only comes once a generation.' },
  { t: 'The Quiet Hours', g: [9648, 18], type: 'tv', o: 'A hospice night nurse keeps a journal of last words that begin to describe her own life.' },
  { t: 'Farewell, Comet', g: [878, 10751], type: 'movie', o: 'A family road-trips to the one spot on Earth where a once-in-a-lifetime comet will be visible.' },
];

const pad = (n: number) => String(n).padStart(2, '0');

export const MOCK_TITLES: TmdbTitle[] = SEEDS.map((s, i) => {
  const isTv = s.type === 'tv';
  const year = 2015 + (i % 11);
  const month = 1 + ((i * 5) % 12);
  const day = 1 + ((i * 11) % 28);
  const rating = Math.round((6.1 + ((i * 37) % 33) / 10) * 10) / 10; // 6.1 .. 9.3
  return {
    id: 1000 + i,
    media_type: s.type,
    ...(isTv ? { name: s.t } : { title: s.t }),
    overview: s.o,
    poster_path: `/lf${i}`,
    backdrop_path: `/lfbg${i}`,
    genre_ids: s.g,
    vote_average: rating,
    release_date: `${year}-${pad(month)}-${pad(day)}`,
    runtime: isTv ? 42 + (i % 4) * 6 : 88 + ((i * 13) % 61),
    certification: isTv ? CERTS_TV[i % CERTS_TV.length] : CERTS_MOVIE[i % CERTS_MOVIE.length],
    popularity: Math.round((20 + ((i * 53) % 97) * 4.3) * 10) / 10, // deterministic 20 .. ~437
  };
});

/**
 * Trailer fixtures. Our titles are fictional, so the mock points at openly licensed
 * Blender Foundation shorts on YouTube. Some titles (e.g. 1028, the 5th trending
 * slide) deliberately have no trailer so the "no preview" path is exercised.
 */
const TRAILER_KEYS: Array<[titleId: number, key: string, name: string]> = [
  [1000, 'aqz-KE-bpKQ', 'Official Trailer'],
  [1007, 'eRsGyueVLvQ', 'Official Trailer'],
  [1014, 'R6MlUcmOul8', 'Teaser'],
  [1021, 'TLkA0RELQ1g', 'Official Trailer'],
  [1035, 'Y-rmzh0PI3c', 'Official Trailer'],
  [1042, 'WhWc3b3KhnY', 'Official Trailer'],
  [1049, 'mN0zPOpADL4', 'Official Trailer'],
];

export const MOCK_VIDEOS: Record<number, TmdbVideo[]> = Object.fromEntries(
  TRAILER_KEYS.map(([titleId, key, name]) => [
    titleId,
    [
      { id: `v${titleId}-bts`, key: `lf-bts-${titleId}`, name: 'Behind the scenes', site: 'Vimeo', type: 'Featurette' },
      {
        id: `v${titleId}`,
        key,
        name,
        site: 'YouTube',
        type: name === 'Teaser' ? 'Teaser' : 'Trailer',
        official: true,
      },
    ],
  ]),
);

const PAGE_SIZE = 20;

/** Picsum seeds so mock art is stable across reloads. Sizes follow TMDB naming. */
export function mockImageUrl(path: string, size: TmdbImageSize = 'w500'): string {
  const seed = path.replace(/^\//, '') || 'lastframe';
  const isBackdrop = seed.includes('bg') || size === 'w780' || size === 'w1280';
  const dims = isBackdrop
    ? size === 'original' ? '1920/1080' : size === 'w1280' ? '1280/720' : '780/440'
    : size === 'original' ? '1000/1500' : size === 'w342' ? '342/513' : '500/750';
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${dims}`;
}

function paginate(items: TmdbTitle[], page = 1): TmdbPage<TmdbTitle> {
  const total_pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), total_pages);
  return {
    page: p,
    results: items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE),
    total_pages,
    total_results: items.length,
  };
}

/** Small artificial latency so loading states are exercised, skipped in tests. */
const latency = () =>
  new Promise<void>((r) => setTimeout(r, typeof window === 'undefined' ? 0 : 120 + Math.random() * 180));

const byType = (t?: MediaType) => (t ? MOCK_TITLES.filter((x) => x.media_type === t) : MOCK_TITLES);

const MOCK_FIRST = ['Ava', 'Rafael', 'Mina', 'Theo', 'Juno', 'Kai', 'Lena', 'Omar', 'Iris', 'Silas'];
const MOCK_LAST = ['Marlow', 'Okafor', 'Vance', 'Ishikawa', 'Brandt', 'Solis', 'Reyes', 'Lindqvist', 'Adeyemi', 'Hale'];
const person = (n: number) => `${MOCK_FIRST[n % MOCK_FIRST.length]} ${MOCK_LAST[(n * 3) % MOCK_LAST.length]}`;

/** Fictional credits / related titles so detail views work fully offline. */
export function mockDetails(t: TmdbTitle): TmdbTitleDetails {
  const i = t.id - 1000;
  const related = MOCK_TITLES.filter(
    (x) => x.id !== t.id && x.genre_ids.some((g) => t.genre_ids.includes(g)),
  );
  return {
    ...t,
    genres: MOCK_GENRES.filter((g) => t.genre_ids.includes(g.id)),
    tagline: '',
    status: 'Released',
    original_language: 'en',
    ...(t.media_type === 'tv' ? { number_of_seasons: 1 + (i % 4), number_of_episodes: 8 + (i % 4) * 2 } : {}),
    credits: {
      cast: Array.from({ length: 6 }, (_, k) => ({
        id: 50000 + i * 10 + k,
        name: person(i + k),
        character: k === 0 ? 'Lead' : `Supporting ${k}`,
        profile_path: `/lfp${(i + k) % 40}`,
        order: k,
      })),
      crew: [
        { id: 60000 + i, name: person(i + 7), job: 'Director', department: 'Directing', profile_path: '' },
        { id: 61000 + i, name: person(i + 4), job: 'Screenplay', department: 'Writing', profile_path: '' },
      ],
    },
    videos: [],
    similar: related.slice(0, 10),
    recommendations: [...related].sort((a, b) => b.vote_average - a.vote_average).slice(0, 10),
    watchProviders: {},
  };
}

export function createMockTmdb(): TmdbService {
  return {
    async trending(page, opts) {
      await latency();
      // Deterministic "trending" shuffle: stride through the catalogue.
      const stride = MOCK_TITLES.map((_, i) => MOCK_TITLES[(i * 7) % MOCK_TITLES.length]);
      const kind = opts?.mediaType;
      const windowed = opts?.window === 'week' ? [...stride].reverse() : stride;
      return paginate(kind && kind !== 'all' ? windowed.filter((t) => t.media_type === kind) : windowed, page);
    },
    async popular(mediaType, page) {
      await latency();
      return paginate([...byType(mediaType)].sort((a, b) => b.vote_average - a.vote_average), page);
    },
    async topRated(mediaType, page) {
      await latency();
      return paginate(byType(mediaType).filter((t) => t.vote_average >= 7.5), page);
    },
    async nowPlaying(page) {
      await latency();
      const recent = [...byType('movie')].sort((a, b) => b.release_date.localeCompare(a.release_date));
      return paginate(recent, page);
    },
    async discover({ mediaType, genreId, page, sortBy, yearFrom, yearTo, minRating } = {}) {
      await latency();
      const items = byType(mediaType).filter((t) => {
        if (genreId != null && !t.genre_ids.includes(genreId)) return false;
        if (minRating != null && t.vote_average < minRating) return false;
        if (yearFrom != null || yearTo != null) {
          const y = Number(t.release_date.slice(0, 4));
          if (!Number.isFinite(y) || y <= 0) return false;
          if (yearFrom != null && y < yearFrom) return false;
          if (yearTo != null && y > yearTo) return false;
        }
        return true;
      });
      return paginate(sortBy ? sortTitles(items, sortBy) : items, page);
    },
    async search(query, page, filters = {}) {
      await latency();
      const q = query.trim().toLowerCase();
      if (!q) return paginate([], page);
      const { mediaType, year, genreId, minRating } = filters;
      const items = MOCK_TITLES.filter(
        (t) =>
          (t.title ?? t.name ?? '').toLowerCase().includes(q) &&
          (mediaType == null || t.media_type === mediaType) &&
          (year == null || t.release_date.startsWith(String(year))) &&
          (genreId == null || t.genre_ids.includes(genreId)) &&
          (minRating == null || t.vote_average >= minRating),
      );
      return paginate(items, page);
    },
    async details(mediaType, id) {
      await latency();
      const t = MOCK_TITLES.find((x) => x.id === id && x.media_type === mediaType);
      return t ? mockDetails(t) : null;
    },
    async genres(mediaType) {
      // Like TMDB's per-type lists: only genres that have titles of that type.
      if (!mediaType) return MOCK_GENRES;
      const ids = new Set(byType(mediaType).flatMap((t) => t.genre_ids));
      return MOCK_GENRES.filter((g) => ids.has(g.id));
    },
    async videos(mediaType, id) {
      await latency();
      const exists = MOCK_TITLES.some((t) => t.id === id && t.media_type === mediaType);
      return exists ? (MOCK_VIDEOS[id] ?? []) : [];
    },
    imageUrl: mockImageUrl,
    async upcoming(page) {
      await latency();
      const soonest = [...byType('movie')].sort((a, b) => a.release_date.localeCompare(b.release_date));
      return paginate(soonest, page);
    },
    async byGenre(genreId, { mediaType, page } = {}) {
      await latency();
      const items = byType(mediaType).filter((t) => t.genre_ids.includes(genreId));
      return paginate([...items].sort((a, b) => b.vote_average - a.vote_average), page);
    },
    async credits(mediaType, id) {
      await latency();
      return findMock(mediaType, id) ? mockCredits(id) : [];
    },
    async similar(mediaType, id, page) {
      await latency();
      const t = findMock(mediaType, id);
      return paginate(t ? mockSimilar(t) : [], page);
    },
    async watchProviders(mediaType, id, region) {
      await latency();
      const t = findMock(mediaType, id);
      return t ? mockWatchProviders(t, region) : null;
    },
  };
}

/* ------------------------------------------------ Title extras fixtures */

const findMock = (mediaType: MediaType, id: number) =>
  MOCK_TITLES.find((t) => t.id === id && t.media_type === mediaType);

/** Invented names; combined deterministically per title. */
const FIRST_NAMES = [
  'Mara', 'Idris', 'Juno', 'Tobias', 'Selene', 'Rafael', 'Anouk', 'Kenji', 'Priya', 'Otto',
  'Lena', 'Caspian', 'Noor', 'Declan', 'Ines', 'Wes', 'Yara', 'Felix', 'Hana', 'Rowan',
];
const LAST_NAMES = [
  'Vale', 'Okafor', 'Lindqvist', 'Moreau', 'Achterberg', 'Castillo', 'Hale', 'Nakamura', 'Rao', 'Brandt',
  'Sørensen', 'Quill', 'Haddad', 'Fairweather', 'Duarte', 'Kowal', 'Ashby', 'Ferreira', 'Mori', 'Byrne',
];
const ROLES = [
  'The Courier', 'Dr. Elin Voss', 'Captain Reyes', 'The Stranger', 'Nell', 'Agent Holloway', 'Theo',
  'The Archivist', 'Marguerite', 'Sam', 'Old Ferryman', 'Detective Lark', 'Pilot', 'Iris', 'The Voice',
];

export function mockCredits(titleId: number): TmdbCastMember[] {
  const seed = titleId - 1000;
  const count = 8 + (seed % 5);
  return Array.from({ length: count }, (_, order) => {
    const f = FIRST_NAMES[(seed * 3 + order * 7) % FIRST_NAMES.length];
    const l = LAST_NAMES[(seed * 5 + order * 11) % LAST_NAMES.length];
    return {
      id: 50_000 + seed * 100 + order,
      name: `${f} ${l}`,
      character: ROLES[(seed + order * 4) % ROLES.length],
      // Every fourth member has no headshot so the monogram fallback is exercised.
      profile_path: order % 4 === 3 ? null : `/lfcast${seed}-${order}`,
      order,
    };
  });
}

/** Titles sharing the most genres, best-rated first; excludes the title itself. */
export function mockSimilar(t: TmdbTitle): TmdbTitle[] {
  const overlap = (x: TmdbTitle) => x.genre_ids.filter((g) => t.genre_ids.includes(g)).length;
  return MOCK_TITLES.filter((x) => x.id !== t.id && overlap(x) > 0).sort(
    (a, b) => overlap(b) - overlap(a) || b.vote_average - a.vote_average || a.id - b.id,
  );
}

/** Fictional services; logos intentionally empty so the UI renders monograms. */
export const MOCK_PROVIDERS: TmdbWatchProvider[] = [
  { provider_id: 9001, provider_name: 'Lumen+', logo_path: '', display_priority: 1 },
  { provider_id: 9002, provider_name: 'Reelhouse', logo_path: '', display_priority: 2 },
  { provider_id: 9003, provider_name: 'Nova Stream', logo_path: '', display_priority: 3 },
  { provider_id: 9004, provider_name: 'Marquee', logo_path: '', display_priority: 4 },
  { provider_id: 9005, provider_name: 'Cinevault', logo_path: '', display_priority: 5 },
  { provider_id: 9006, provider_name: 'Northern Lights TV', logo_path: '', display_priority: 6 },
];

export function mockWatchProviders(t: TmdbTitle, region: WatchRegion): TmdbWatchProviders {
  const seed = t.id - 1000;
  const pick = (...idx: number[]) => idx.map((i) => MOCK_PROVIDERS[i % MOCK_PROVIDERS.length]);
  const base: TmdbWatchProviders = { region, link: '' };
  // Every seventh title is unavailable in Canada so the empty state is exercised.
  if (region === 'CA' && seed % 7 === 6) return base;
  const offset = region === 'CA' ? 2 : 0;
  return {
    ...base,
    flatrate: pick(seed + offset, seed + offset + 3),
    ...(seed % 3 === 0 ? { free: pick(5) } : {}),
    rent: pick(seed + offset + 1),
    buy: pick(seed + offset + 1, seed + offset + 4),
  };
}
