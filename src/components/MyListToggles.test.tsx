import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Movie } from '../services/types';
import { selectWatchlist, useLastFrameStore } from '../state/store';
import MovieCard from './MovieCard';
import { ToastProvider } from './ui';

const MOVIE: Movie = {
  id: 1002,
  mediaType: 'tv',
  title: 'Midnight Protocol',
  year: 2017,
  rating: 'TV-MA',
  match: 88,
  genres: ['Thriller'],
  description: 'A night-shift dispatcher.',
  poster: '/p.jpg',
  backdrop: '/b.jpg',
  runtime: 42,
};

const list = () => selectWatchlist(useLastFrameStore.getState());

describe('My List toggles', () => {
  beforeEach(() => useLastFrameStore.setState({ watchlist: {} }));

  it('card hover button adds (with a toast) and removes the title', () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <MovieCard movie={MOVIE} delay={0} />
        </MemoryRouter>
      </ToastProvider>,
    );
    // The toggle is a sibling of the card link, not nested inside it.
    const link = screen.getByRole('link', { name: 'Midnight Protocol (2017)' });
    const add = screen.getByRole('button', { name: 'Add Midnight Protocol to My List' });
    expect(link).not.toContainElement(add);
    expect(add).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(add);
    expect(list()).toMatchObject([{ titleId: 1002, mediaType: 'tv' }]);
    expect(screen.getByRole('status')).toHaveTextContent('Added Midnight Protocol to My List');

    const remove = screen.getByRole('button', { name: 'Remove Midnight Protocol from My List' });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(remove);
    expect(list()).toEqual([]);
  });

  it('card can hide the toggle and still renders without a ToastProvider', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MovieCard movie={MOVIE} delay={0} listToggle={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /my list/i })).toBeNull();
    rerender(
      <MemoryRouter>
        <MovieCard movie={MOVIE} delay={0} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /add midnight protocol/i }));
    expect(list()).toHaveLength(1);
  });

  // The modal My List toggle is covered in components/title/TrailerModal.test.tsx.
});
