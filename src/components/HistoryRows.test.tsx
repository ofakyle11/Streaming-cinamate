import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Movie } from '../services/types';
import { useLastFrameStore } from '../state/store';
import HistoryRows from './HistoryRows';

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
});
