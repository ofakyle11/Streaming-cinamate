import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Row from '../components/Row';
import { TITLE_PLACEHOLDER_IMAGE, imageOrPlaceholder } from './images';
import { toMovie } from './index';
import type { TmdbTitle } from './types';
import { createMockTmdb } from './tmdb/mock';
import { createLiveTmdb } from './tmdb/live';

/** Shape of a real TMDB list item: null image paths, no certification. */
const liveTitle = {
  id: 42,
  media_type: 'movie',
  title: 'No Art',
  overview: 'o',
  poster_path: null,
  backdrop_path: null,
  genre_ids: [28],
  vote_average: 7,
  release_date: '2024-01-01',
} as unknown as TmdbTitle;

const genres = [{ id: 28, name: 'Action' }];

describe('images', () => {
  it('placeholder is an inline svg data URI', () => {
    expect(TITLE_PLACEHOLDER_IMAGE.startsWith('data:image/svg+xml,')).toBe(true);
    expect(imageOrPlaceholder('')).toBe(TITLE_PLACEHOLDER_IMAGE);
    expect(imageOrPlaceholder('https://x/y.jpg')).toBe('https://x/y.jpg');
  });
});

describe('toMovie with live-shaped data', () => {
  const live = createLiveTmdb('/api/tmdb');

  it('maps null paths to the placeholder and missing certification to ""', () => {
    const m = toMovie(liveTitle, genres, live);
    expect(m.poster).toBe(TITLE_PLACEHOLDER_IMAGE);
    expect(m.backdrop).toBe(TITLE_PLACEHOLDER_IMAGE);
    expect(m.rating).toBe('');
    const tv = toMovie({ ...liveTitle, media_type: 'tv' }, genres, live);
    expect(tv.rating).toBe('');
  });

  it('uses certification when present', () => {
    expect(toMovie({ ...liveTitle, certification: 'R' }, genres, live).rating).toBe('R');
  });

  it('mock titles keep their certification and picsum URLs', async () => {
    const svc = createMockTmdb();
    const page = await svc.trending();
    const t = page.results[0];
    const m = toMovie(t, await svc.genres(), svc);
    expect(t.certification).toBeTruthy();
    expect(m.rating).toBe(t.certification);
    expect(m.poster).toContain('picsum.photos');
    expect(m.backdrop).toContain('picsum.photos');
  });

  it('a Row renders no empty img src and no empty badge', () => {
    const m = toMovie(liveTitle, genres, live);
    const { container } = render(
      <MemoryRouter>
        <Row title="Live" items={[m]} onSelect={() => {}} />
      </MemoryRouter>,
    );
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img.getAttribute('src')).toBeTruthy();
    for (const b of Array.from(container.querySelectorAll('.badge'))) {
      expect(b.textContent?.trim()).toBeTruthy();
    }
  });
});
