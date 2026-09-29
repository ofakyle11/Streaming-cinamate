import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Movie } from '../services/types';
import { useLastFrameStore } from '../state/store';
import HistoryRows from './HistoryRows';
import { ToastProvider } from './ui';

function movie(id: number, title: string, mediaType: Movie['mediaType'] = 'movie'): Movie {
  return {
    id,
    mediaType,
    title,
    year: 2021,
    rating: 'PG',
    match: 88,
    genres: ['Drama'],
    description: '',
    poster: `/p/${id}.jpg`,
    backdrop: `/b/${id}.jpg`,
    runtime: 90,
  };
}

function renderWithToasts() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <HistoryRows />
      </MemoryRouter>
    </ToastProvider>,
  );
}

function section(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

function renderRows() {
  return render(
    <MemoryRouter>
      <HistoryRows />
    </MemoryRouter>,
  );
}

describe('HistoryRows', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ views: {}, history: {} });
  });

  it('renders nothing without history', () => {
    renderRows();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('splits trailer plays into Continue Watching and opens into Recently Viewed', () => {
    act(() => {
      const { recordView } = useLastFrameStore.getState();
      recordView(movie(1, 'Opened Film'), 'open');
      recordView(movie(2, 'Trailer Show', 'tv'), 'trailer');
    });
    renderRows();

    const cw = screen.getByRole('heading', { level: 2, name: 'Continue Watching' }).closest('section')!;
    const cwLinks = within(cw).getAllByRole('link');
    expect(cwLinks).toHaveLength(1);
    expect(cwLinks[0]).toHaveAttribute('href', '/title/tv/2');

    const rv = screen.getByRole('heading', { level: 2, name: 'Recently Viewed' }).closest('section')!;
    expect(within(rv).getByRole('link', { name: /opened film/i })).toHaveAttribute('href', '/title/movie/1');
  });

  it('updates live and disappears when history is cleared', () => {
    renderRows();
    act(() => useLastFrameStore.getState().recordView(movie(3, 'Later'), 'open'));
    expect(screen.getByRole('heading', { name: 'Recently Viewed' })).toBeInTheDocument();
    act(() => useLastFrameStore.getState().clearViews());
    expect(screen.queryByRole('heading', { name: 'Recently Viewed' })).toBeNull();
  });

  it('removes a Recently Viewed card, updates the store and restores it on Undo', () => {
    act(() => {
      const { recordView } = useLastFrameStore.getState();
      recordView(movie(10, 'Keep Me'), 'open');
      recordView(movie(11, 'Drop Me'), 'open');
    });
    renderWithToasts();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Drop Me from Recently Viewed' }));
    expect(screen.queryByRole('link', { name: /drop me/i })).toBeNull();
    expect(within(section('Recently Viewed')).getByRole('link', { name: /keep me/i })).toBeInTheDocument();
    const keys = () => useLastFrameStore.getState().views[useLastFrameStore.getState().activeProfileId!]!.map((e) => e.key);
    expect(keys()).toEqual(['movie:10']);
    expect(screen.getByRole('status')).toHaveTextContent('Removed Drop Me from Recently Viewed');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(section('Recently Viewed')).getByRole('link', { name: /drop me/i })).toBeInTheDocument();
    expect(keys()).toContain('movie:11');
  });

  it('Undo restores the exact entry at its original index without recording a new view', () => {
    const now = Date.now();
    act(() => {
      const s = useLastFrameStore.getState();
      const pid = s.activeProfileId!;
      const entry = (id: number, title: string, at: number) => ({
        key: `movie:${id}`,
        title: { ...movie(id, title) },
        firstViewedAt: at - 5000,
        lastViewedAt: at,
        views: id,
      });
      useLastFrameStore.setState({
        views: {
          [pid]: [entry(1, 'First', now - 1000), entry(2, 'Middle', now - 2000), entry(3, 'Last', now - 3000)],
        },
      });
    });
    renderWithToasts();
    const pid = useLastFrameStore.getState().activeProfileId!;
    const before = useLastFrameStore.getState().views[pid]!.find((e) => e.key === 'movie:2')!;
    const titles = () =>
      within(section('Recently Viewed'))
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'));
    expect(titles()).toEqual(['/title/movie/1', '/title/movie/2', '/title/movie/3']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Middle from Recently Viewed' }));
    expect(titles()).toEqual(['/title/movie/1', '/title/movie/3']);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(titles()).toEqual(['/title/movie/1', '/title/movie/2', '/title/movie/3']);
    const after = useLastFrameStore.getState().views[pid]!.find((e) => e.key === 'movie:2')!;
    expect(after).toEqual(before);
    expect(after.views).toBe(2);
    expect(after.lastViewedAt).toBe(now - 2000);
    expect(after.trailerPlayedAt).toBeUndefined();
  });

  it('removes a Continue Watching card and Undo keeps it in Continue Watching', () => {
    act(() => useLastFrameStore.getState().recordView(movie(20, 'Trailer Film'), 'trailer'));
    renderWithToasts();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Trailer Film from Continue Watching' }));
    expect(screen.queryByRole('heading', { name: 'Continue Watching' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(section('Continue Watching')).getByRole('link', { name: /trailer film/i })).toBeInTheDocument();
    expect(within(section('Continue Watching')).getByText('Trailer watched')).toBeInTheDocument();
  });

  it('shows a progress bar that reflects recordProgress', () => {
    act(() => {
      const s = useLastFrameStore.getState();
      s.recordView(movie(30, 'Half Way'), 'open');
      s.recordProgress(30, 1800, 5400);
    });
    renderWithToasts();

    const cw = section('Continue Watching');
    const bar = within(cw).getByRole('progressbar', { name: /half way/i });
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(within(cw).queryByText('Trailer watched')).toBeNull();

    act(() => useLastFrameStore.getState().recordProgress(30, 2700, 5400));
    expect(within(cw).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows a Trailer watched pill (no progress bar) for trailer-only entries', () => {
    act(() => useLastFrameStore.getState().recordView(movie(40, 'Teaser'), 'trailer'));
    renderWithToasts();
    const cw = section('Continue Watching');
    expect(within(cw).getByText('Trailer watched')).toBeInTheDocument();
    expect(within(cw).queryByRole('progressbar')).toBeNull();
  });
});

describe('HistoryRows title identity', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ views: {}, history: {} });
  });

  it('keys progress by media type so a movie and series sharing an id stay separate', () => {
    act(() => {
      const s = useLastFrameStore.getState();
      s.recordView(movie(70, 'Film Seventy', 'movie'), 'trailer');
      s.recordView(movie(70, 'Show Seventy', 'tv'), 'trailer');
      s.recordProgress(70, 2700, 5400, 'tv');
    });
    renderWithToasts();
    const cw = section('Continue Watching');
    expect(within(cw).getByRole('progressbar', { name: /show seventy/i })).toHaveAttribute('aria-valuenow', '50');
    expect(within(cw).queryByRole('progressbar', { name: /film seventy/i })).toBeNull();
  });
});
