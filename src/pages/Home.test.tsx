import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockTmdb } from '../services/tmdb/mock';
import type { TmdbService } from '../services/types';
import Home from './Home';

function TitleProbe() {
  const { type, id } = useParams();
  return (
    <p>
      title route {type}/{id}
    </p>
  );
}

function renderHome(svc: TmdbService) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home svc={svc} />} />
        <Route path="/title/:type/:id" element={<TitleProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Waits until the named row has finished loading and returns its section. */
async function readyRow(title: string): Promise<HTMLElement> {
  let section: HTMLElement | null = null;
  await waitFor(
    () => {
      const heading = screen.getByRole('heading', { level: 2, name: title });
      section = heading.closest('section') as HTMLElement;
      expect(section).not.toHaveAttribute('aria-busy');
      expect(within(section).getAllByRole('link').length).toBeGreaterThan(0);
    },
    { timeout: 3000 },
  );
  return section as unknown as HTMLElement;
}

const ROW_TITLES = [
  'Trending Now',
  'Popular Movies',
  'Popular TV',
  'Top Rated',
  'New & Upcoming',
  'Action Hits',
  'Comedy Picks',
  'Sci-Fi & Beyond',
];

describe('Home', () => {
  it('shows skeleton rows, then every row from the tmdb service', async () => {
    renderHome(createMockTmdb());

    for (const t of ROW_TITLES) {
      expect(screen.getByRole('region', { name: `${t}, loading` })).toHaveAttribute(
        'aria-busy',
        'true',
      );
    }

    for (const t of ROW_TITLES) await readyRow(t);
    expect(screen.queryByRole('region', { name: /loading/ })).toBeNull();
  });

  it('cards link to /title/:type/:id', async () => {
    renderHome(createMockTmdb());
    const link = within(await readyRow('Popular TV')).getAllByRole('link')[0];
    expect(link.getAttribute('href')).toMatch(/^\/title\/tv\/\d+$/);

    const movieLink = within(await readyRow('Popular Movies')).getAllByRole('link')[0];
    const href = movieLink.getAttribute('href') as string;
    expect(href).toMatch(/^\/title\/movie\/\d+$/);

    fireEvent.click(movieLink);
    expect(
      await screen.findByText(`title route ${href.replace('/title/', '')}`),
    ).toBeInTheDocument();
  });

  it('shows a per-row error with a working retry', async () => {
    const base = createMockTmdb();
    let failTv = true;
    const svc: TmdbService = {
      ...base,
      popular: (mediaType, page) =>
        mediaType === 'tv' && failTv
          ? Promise.reject(new Error('TV is down'))
          : base.popular(mediaType, page),
    };
    renderHome(svc);

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toHaveTextContent('Couldn’t load Popular TV.');
    expect(alert).toHaveTextContent('TV is down');
    // Other rows still render.
    await readyRow('Popular Movies');

    failTv = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry Popular TV' }));
    expect(screen.getByRole('region', { name: 'Popular TV, loading' })).toBeInTheDocument();

    await readyRow('Popular TV');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a page-level error when everything fails, and retries all rows', async () => {
    const base = createMockTmdb();
    let down = true;
    const svc: TmdbService = {
      ...base,
      genres: () => (down ? Promise.reject(new Error('offline')) : base.genres()),
    };
    renderHome(svc);

    expect(
      await screen.findByRole('heading', { level: 1, name: /couldn’t load the catalogue/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    down = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    for (const t of ROW_TITLES) await readyRow(t);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Home load states (polish)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const allDown = (err: () => Error): TmdbService => {
    const base = createMockTmdb();
    return { ...base, genres: () => Promise.reject(err()) };
  };

  it('retries transient failures, then shows the ErrorCard as the only <main>', async () => {
    const base = createMockTmdb();
    let calls = 0;
    const svc: TmdbService = {
      ...base,
      genres: () => {
        calls++;
        return Promise.reject(new TypeError('Failed to fetch'));
      },
    };
    renderHome(svc);

    const alert = await screen.findByRole(
      'alert',
      { name: /couldn.t load the catalogue/i },
      { timeout: 4000 },
    );
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(alert).toHaveAccessibleName(/couldn.t load the catalogue/i);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(within(alert).queryByRole('link', { name: /go home/i })).not.toBeInTheDocument();
  }, 10000);

  it('says so when the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderHome(allDown(() => new Error('offline')));
    expect(
      await screen.findByText(
        'You appear to be offline. Reconnect and try again.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  }, 10000);

  it('puts the hero h1 inside the main landmark', async () => {
    renderHome(createMockTmdb());
    const h1 = await screen.findByRole('heading', { level: 1 }, { timeout: 3000 });
    const main = screen.getByRole('main');
    expect(main).toContainElement(h1);
    expect(main).toContainElement(await readyRow('Trending Now'));
  });
});
