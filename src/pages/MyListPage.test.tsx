import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../components/ui';
import { createMockTmdb } from '../services/tmdb/mock';
import type { TmdbService } from '../services/types';
import { selectWatchlist, useLastFrameStore } from '../state/store';
import MyListPage from './MyListPage';
import { findLive } from '../test/liveRegions';

const T = { timeout: 3000 };

function renderPage(svc: TmdbService = createMockTmdb()) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/my-list']}>
        <MyListPage svc={svc} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const ids = () => selectWatchlist(useLastFrameStore.getState()).map((e) => e.titleId);

describe('MyListPage', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ watchlist: {} });
  });

  it('shows the empty state with ways to browse', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: /your list is empty/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse titles/i })).toHaveAttribute('href', '/');
    expect(screen.getByText('0 titles saved')).toBeInTheDocument();
  });

  it('renders saved titles in a grid, newest first, and sorts them', async () => {
    const { addToWatchlist } = useLastFrameStore.getState();
    addToWatchlist(1000, 'movie'); // Neon Drift
    addToWatchlist(1002, 'tv'); // Midnight Protocol
    addToWatchlist(1001); // The Glass Horizon (legacy entry, no media type)
    renderPage();

    expect(screen.getByRole('status', { name: /loading my list/i })).toBeInTheDocument();
    const grid = await screen.findByRole('list', { name: /saved titles/i }, T);
    const names = () =>
      within(grid)
        .getAllByRole('link')
        .map((a) => a.getAttribute('aria-label'));
    expect(names()).toEqual([
      'The Glass Horizon (2016)',
      'Midnight Protocol (2017)',
      'Neon Drift (2015)',
    ]);
    expect(within(grid).getAllByRole('link')[1]).toHaveAttribute('href', '/title/tv/1002');
    expect(screen.getByText('3 titles saved')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), {
      target: { value: 'title' },
    });
    expect(names()).toEqual([
      'Midnight Protocol (2017)',
      'Neon Drift (2015)',
      'The Glass Horizon (2016)',
    ]);
  });

  it('removes a title from its card and toasts', async () => {
    useLastFrameStore.getState().addToWatchlist(1000, 'movie');
    renderPage();
    const btn = await screen.findByRole('button', { name: 'Remove Neon Drift from My List' }, T);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(ids()).toEqual([]);
    expect(
      screen.getByRole('heading', { level: 2, name: /your list is empty/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Removed Neon Drift from My List')).toBeInTheDocument();
  });

  it('keeps focus in the grid on removal and Undo re-adds with the original media type', async () => {
    const { addToWatchlist } = useLastFrameStore.getState();
    addToWatchlist(1000, 'movie'); // Neon Drift
    addToWatchlist(1002, 'tv'); // Midnight Protocol
    renderPage();
    const btn = await screen.findByRole(
      'button',
      { name: 'Remove Midnight Protocol from My List' },
      T,
    );
    act(() => btn.focus());
    fireEvent.click(btn);
    expect(ids()).toEqual([1000]);
    const grid = screen.getByRole('list', { name: /saved titles/i });
    expect(within(grid).getByRole('link', { name: 'Neon Drift (2015)' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    const entries = selectWatchlist(useLastFrameStore.getState());
    expect(entries.find((e) => e.titleId === 1002)?.mediaType).toBe('tv');
    expect(
      await within(grid).findByRole('link', { name: 'Midnight Protocol (2017)' }),
    ).toHaveAttribute('href', '/title/tv/1002');
  });

  it('moves focus to the empty-state heading when the last title is removed', async () => {
    useLastFrameStore.getState().addToWatchlist(1000, 'movie');
    renderPage();
    const btn = await screen.findByRole('button', { name: 'Remove Neon Drift from My List' }, T);
    act(() => btn.focus());
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { level: 2, name: /your list is empty/i })).toHaveFocus();
  });

  it('offers to clean up titles that no longer resolve', async () => {
    const { addToWatchlist } = useLastFrameStore.getState();
    addToWatchlist(99999, 'movie');
    addToWatchlist(1000, 'movie');
    renderPage();
    await screen.findByText(/1 saved title is no longer available/i, undefined, T);
    fireEvent.click(screen.getByRole('button', { name: /remove it/i }));
    expect(ids()).toEqual([1000]);
    await waitFor(() => expect(screen.queryByText(/no longer available/i)).toBeNull());
  });

  it('shows an error with retry when the catalogue fails', async () => {
    const base = createMockTmdb();
    let down = true;
    const svc: TmdbService = {
      ...base,
      genres: () => (down ? Promise.reject(new Error('offline')) : base.genres()),
    };
    useLastFrameStore.getState().addToWatchlist(1000, 'movie');
    renderPage(svc);
    expect(await findLive('alert', T)).toHaveTextContent('offline');
    down = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: 'Neon Drift (2015)' }, T)).toBeInTheDocument();
  });
});
