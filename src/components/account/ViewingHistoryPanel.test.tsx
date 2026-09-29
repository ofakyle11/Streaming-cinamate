import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Movie } from '../../services/types';
import { selectHistory, selectViews, useLastFrameStore } from '../../state/store';
import { ToastProvider } from '../ui';
import ViewingHistoryPanel from './ViewingHistoryPanel';

const film: Movie = {
  id: 1000,
  mediaType: 'movie',
  title: 'Neon Drift',
  year: 2024,
  rating: 'PG-13',
  match: 97,
  genres: ['Science Fiction'],
  description: '',
  poster: '/p.jpg',
  backdrop: '/b.jpg',
  runtime: 118,
};

function renderPanel() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ViewingHistoryPanel />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('ViewingHistoryPanel', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ views: {}, history: {} });
  });

  it('shows an empty state with the clear button disabled', () => {
    renderPanel();
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear viewing history' })).toBeDisabled();
  });

  it('lists recent titles and clears history after confirming', () => {
    act(() => {
      const s = useLastFrameStore.getState();
      s.recordView(film, 'trailer');
      s.recordProgress(film.id, 60, 6000);
    });
    renderPanel();

    const list = screen.getByRole('list', { name: /recently viewed titles/i });
    const link = within(list).getByRole('link', { name: /neon drift/i });
    expect(link).toHaveAttribute('href', '/title/movie/1000');
    expect(link).toHaveTextContent(/trailer played · just now/i);

    fireEvent.click(screen.getByRole('button', { name: 'Clear viewing history' }));
    // Cancel keeps everything.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(selectViews(useLastFrameStore.getState())).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear viewing history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));

    const state = useLastFrameStore.getState();
    expect(selectViews(state)).toEqual([]);
    expect(selectHistory(state)).toEqual([]);
    expect(screen.queryByRole('list', { name: /recently viewed titles/i })).toBeNull();
    expect(screen.getByText('Viewing history cleared')).toBeInTheDocument();
  });
});
