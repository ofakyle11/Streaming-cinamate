export interface Movie {
  id: number;
  title: string;
  year: number;
  rating: string;
  match: number;
  genres: string[];
  description: string;
  poster: string;
  backdrop: string;
}

const titles = [
  'Neon Drift', 'The Glass Horizon', 'Midnight Protocol', 'Echoes of Aurora', 'Silent Orbit',
  'Crimson Tide Line', 'Paper Kingdoms', 'Velvet Static', 'Last Light Express', 'Hollow Summit',
  'Signal Lost', 'Chrome Hearts', 'The Quiet Coast', 'Parallax', 'Ember & Ash',
  'Northbound', 'Liquid Sky', 'The Cartographer', 'Afterglow', 'Prism Break',
  'Deep Field', 'Wild Frequencies', 'Saltwater Saints', 'Low Tide', 'Kinetic',
  'Starlit Run', 'Glasshouse', 'Fault Lines', 'Overcast', 'Momentum',
];
const genrePool = ['Sci-Fi', 'Drama', 'Thriller', 'Action', 'Mystery', 'Romance', 'Adventure', 'Comedy'];
const ratings = ['PG', 'PG-13', 'TV-14', 'TV-MA', 'R'];

export const movies: Movie[] = titles.map((title, i) => ({
  id: i + 1,
  title,
  year: 2015 + (i % 11),
  rating: ratings[i % ratings.length],
  match: 80 + ((i * 7) % 19),
  genres: [genrePool[i % genrePool.length], genrePool[(i + 3) % genrePool.length]],
  description:
    'A placeholder synopsis for the rough draft. Swap this out for real data from TMDB or your own catalog later.',
  poster: `https://picsum.photos/seed/cine${i}/400/600`,
  backdrop: `https://picsum.photos/seed/cinebg${i}/1600/900`,
}));

export const rows: { title: string; items: Movie[] }[] = [
  { title: 'Trending Now', items: movies.slice(0, 10) },
  { title: 'Top Picks for You', items: movies.slice(10, 20) },
  { title: 'New Releases', items: movies.slice(20, 30) },
  { title: 'Sci-Fi & Beyond', items: [...movies].reverse().slice(0, 10) },
];
