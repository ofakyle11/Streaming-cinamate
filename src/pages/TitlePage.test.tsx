import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui';
import { analytics, tmdb } from '../services';
import { selectRatingFor, selectIsInWatchlist, selectViews, useLastFrameStore } from '../state/store';
import TitlePage from './TitlePage';
import { createMockTmdb } from '../services/tmdb/mock';
import { getLive, queryLive } from '../test/liveRegions';

const T = { timeout: 3000 };

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/title/:type/:id" element={<TitlePage />} />
          <Route path="/" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('TitlePage', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ watchlist: {}, ratings: {} });
    // jsdom does not implement scrolling; TitleView scrolls to top on mount.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a skeleton, then the glass info panel', async () => {
    renderAt('/title/movie/1000');
    expect(getLive('status')).toHaveTextContent(/loading title/i);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
    const panel = heading.closest('article')!;
    expect(within(panel).getByLabelText('Genres')).toHaveTextContent('Science Fiction');
    expect(within(panel).getByText(/courier in a rain-soaked megacity/i)).toBeInTheDocument();
    expect(within(panel).getByText(/PG/)).toBeInTheDocument();
    expect(within(panel).getByText(/% Match/)).toBeInTheDocument();
  });

  it('renders cast, similar row and where-to-watch with JustWatch attribution', async () => {
    renderAt('/title/movie/1000');
    await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);

    expect(screen.getByRole('heading', { name: 'Cast' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /cast members/i }).children.length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'More like this' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'JustWatch' })).toHaveAttribute('href', 'https://www.justwatch.com');

    await screen.findByRole('heading', { name: 'Stream' }, T);
    const ca = screen.getByRole('radio', { name: 'Canada' });
    fireEvent.click(ca);
    expect(ca).toHaveAttribute('aria-checked', 'true');
    await screen.findByRole('heading', { name: 'Stream' }, T);
  });

  it('toggles My List in the store', async () => {
    renderAt('/title/movie/1000');
    await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
    const btn = screen.getByRole('button', { name: /^my list$/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(selectIsInWatchlist(1000)(useLastFrameStore.getState())).toBe(true);
    fireEvent.click(btn);
    expect(selectIsInWatchlist(1000)(useLastFrameStore.getState())).toBe(false);
  });

  it('rates a title from the Rate popover', async () => {
    renderAt('/title/movie/1000');
    await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
    fireEvent.click(screen.getByRole('button', { name: /^rate$/i }));
    fireEvent.click(screen.getByRole('radio', { name: /4 stars/i }));
    expect(selectRatingFor(1000)(useLastFrameStore.getState())).toBe(4);
    expect(screen.getByRole('button', { name: /rated 4\/5/i })).toBeInTheDocument();
  });

  it('opens the trailer modal and closes it with Escape', async () => {
    renderAt('/title/movie/1000');
    await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
    fireEvent.click(screen.getByRole('button', { name: /play trailer/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/official trailer/i);
    expect(within(dialog).getByTitle('Neon Drift trailer')).toHaveAttribute(
      'src',
      expect.stringMatching(/^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ\?/),
    );
    expect(screen.getByRole('button', { name: /close trailer/i })).toHaveFocus();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('records the page open and trailer play in viewing history', async () => {
    useLastFrameStore.setState({ views: {} });
    renderAt('/title/movie/1000');
    await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);

    let [entry] = selectViews(useLastFrameStore.getState());
    expect(entry).toMatchObject({ key: 'movie:1000', views: 1, title: { title: 'Neon Drift' } });
    expect(entry.trailerPlayedAt).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: /play trailer/i }));
    [entry] = selectViews(useLastFrameStore.getState());
    expect(entry.views).toBe(2);
    expect(entry.trailerPlayedAt).toEqual(expect.any(Number));
  });

  it('disables Play trailer when the title has none', async () => {
    // Mock title id 1028 ("Overcast") has no entry in the MOCK_VIDEOS fixtures.
    renderAt('/title/movie/1028');
    await screen.findByRole('heading', { level: 1, name: 'Overcast' }, T);
    expect(screen.getByRole('button', { name: /no trailer/i })).toBeDisabled();
  });

  it.each(['/title/movie/99999', '/title/film/1000', '/title/movie/abc', '/title/movie/1002'])(
    'shows the not-found state for %s',
    async (path) => {
      renderAt(path);
      await waitFor(() => expect(getLive('alert')).toHaveTextContent(/couldn’t find that title/i), T);
      expect(screen.getByRole('link', { name: /back home/i })).toHaveAttribute('href', '/');
    },
  );

  describe('opening a Similar card', () => {
    it('pushes a single history entry, scrolls to top and focuses the new heading', async () => {
      const scrollTo = vi.mocked(window.scrollTo);
      const track = vi.spyOn(analytics, 'track');
      const router = createMemoryRouter([{ path: '/title/:type/:id', element: <TitlePage /> }], {
        initialEntries: ['/title/movie/1000'],
      });
      const actions: string[] = [];
      const unsubscribe = router.subscribe((state) => {
        if (state.navigation.state === 'idle') actions.push(`${state.historyAction} ${state.location.pathname}`);
      });
      render(
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>,
      );

      const first = await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
      expect(first).toHaveFocus();
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
      scrollTo.mockClear();

      const similar = within(
        screen.getByRole('heading', { name: 'More like this' }).closest('section')!,
      ).getAllByRole('link')[0];
      const href = similar.getAttribute('href')!;
      expect(href).toMatch(/^\/title\/(movie|tv)\/\d+$/);
      const [, , type, id] = href.split('/');
      fireEvent.click(similar);

      expect(actions).toEqual([`PUSH ${href}`]);
      expect(track).toHaveBeenCalledWith('title-open', { id: Number(id), mediaType: type, source: 'similar' });

      const next = await screen.findByRole('heading', { level: 1, name: /.+/ }, T);
      await waitFor(() => expect(next).not.toHaveTextContent('Neon Drift'), T);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(), T);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

      // One press of Back returns to the original title.
      await act(() => router.navigate(-1));
      await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
      expect(router.state.location.pathname).toBe('/title/movie/1000');
      unsubscribe();
    });

    it('jumps (no smooth scroll) when the user prefers reduced motion', async () => {
      const scrollTo = vi.mocked(window.scrollTo);
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: query.includes('prefers-reduced-motion'),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: () => false,
          }) as MediaQueryList,
      );
      renderAt('/title/movie/1000');
      await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    });
  });
});

describe('TitlePage data resolution (details())', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a TV title found via search (not only home-catalogue items)', async () => {
    const { results } = await createMockTmdb().search('the', 1, { mediaType: 'tv' });
    // Pick the last hit so it is unlikely to be one of the home rows.
    const hit = results[results.length - 1];
    renderAt(`/title/tv/${hit.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: hit.name }, T)).toBeInTheDocument();
    expect(screen.queryByText(/couldn’t find that title/)).not.toBeInTheDocument();
  });

  it('shows not found for an unknown id', async () => {
    renderAt('/title/movie/987654');
    expect(await screen.findByRole('heading', { name: /couldn’t find that title/ }, T)).toBeInTheDocument();
  });

  it('shows not found for a bad type', async () => {
    renderAt('/title/person/1000');
    expect(await screen.findByRole('heading', { name: /couldn’t find that title/ }, T)).toBeInTheDocument();
  });
});

describe('TitlePage load failure (ErrorCard + withRetry)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the ErrorCard (not "not found") when loading fails, and retries', async () => {
    const { results } = await createMockTmdb().popular('movie', 1);
    const first = results[0];
    const details = vi.spyOn(tmdb, 'details').mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt(`/title/movie/${first.id}`);

    const alert = await screen.findByRole('alert', { name: 'Something went wrong' }, { timeout: 4000 });
    expect(details).toHaveBeenCalledTimes(3);
    expect(alert).toHaveAccessibleName('Something went wrong');
    expect(screen.queryByText(/couldn’t find that title/)).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toMatch(/Something went wrong/));

    details.mockRestore();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: first.title ?? first.name }, T)).toBeInTheDocument();
    expect(queryLive('alert')).not.toBeInTheDocument();
  }, 10000);
});
