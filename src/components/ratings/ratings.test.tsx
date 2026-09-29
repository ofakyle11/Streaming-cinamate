import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '../../services/types';
import { selectRatingFor, selectThumbFor, selectThumbForTitle, selectThumbs, useLastFrameStore } from '../../state/store';
import MovieCard from '../MovieCard';
import { ToastProvider } from '../ui';
import StarRating from './StarRating';
import ThumbsControl from './ThumbsControl';

const state = () => useLastFrameStore.getState();

const movie: Movie = {
  id: 1000,
  mediaType: 'movie',
  title: 'Neon Drift',
  year: 2024,
  rating: 'PG-13',
  match: 95,
  genres: ['Science Fiction'],
  description: '',
  poster: '',
  backdrop: '',
  runtime: 110,
};

describe('ratings controls', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ ratings: {}, thumbs: {} });
  });

  it('toggles thumbs up/down and reports changes', () => {
    const onChange = vi.fn();
    render(<ThumbsControl titleId={1000} mediaType="movie" title="Neon Drift" onChange={onChange} />);
    const up = screen.getByRole('button', { name: 'I like Neon Drift' });
    const down = screen.getByRole('button', { name: /not for me/i });

    fireEvent.click(up);
    expect(up).toHaveAttribute('aria-pressed', 'true');
    expect(selectThumbs(state())[0]).toMatchObject({ titleId: 1000, thumb: 'up', mediaType: 'movie', title: 'Neon Drift' });

    fireEvent.click(down);
    expect(down).toHaveAttribute('aria-pressed', 'true');
    expect(up).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(down);
    expect(selectThumbFor(1000)(state())).toBeNull();
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['up', 'down', null]);
  });

  it('sets and clears optional stars', () => {
    render(<StarRating titleId={1000} mediaType="movie" title="Neon Drift" />);
    fireEvent.click(screen.getByRole('radio', { name: '4 out of 5' }));
    expect(selectRatingFor(1000)(state())).toBe(4);
    expect(screen.getByRole('radio', { name: '4 out of 5' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '4 out of 5' }));
    expect(selectRatingFor(1000)(state())).toBeNull();
  });

  it('card overlay rates without navigating away from the card link', () => {
    render(
      <MemoryRouter>
        <MovieCard movie={movie} delay={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Neon Drift (2024)' })).toHaveAttribute('href', '/title/movie/1000');
    const up = screen.getByRole('button', { name: 'I like Neon Drift' });
    expect(up.closest('a')).toBeNull();
    fireEvent.click(up);
    expect(selectThumbFor(1000)(state())).toBe('up');
    fireEvent.click(screen.getByRole('radio', { name: '5 out of 5' }));
    expect(selectRatingFor(1000)(state())).toBe(5);
  });
});

describe('ratings controls title identity', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ ratings: {}, thumbs: {} });
  });

  it('a thumb or stars on the movie do not light up the series with the same id', () => {
    render(
      <>
        <ThumbsControl titleId={1000} mediaType="movie" title="Film" />
        <ThumbsControl titleId={1000} mediaType="tv" title="Show" />
        <StarRating titleId={1000} mediaType="movie" title="Film" />
        <StarRating titleId={1000} mediaType="tv" title="Show" />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'I like Film' }));
    expect(screen.getByRole('button', { name: 'I like Film' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'I like Show' })).toHaveAttribute('aria-pressed', 'false');

    const tvStars = screen.getByRole('radiogroup', { name: 'Stars for Show' });
    const movieStars = screen.getByRole('radiogroup', { name: 'Stars for Film' });
    fireEvent.click(within(tvStars).getByRole('radio', { name: '4 out of 5' }));
    expect(within(tvStars).getByRole('radio', { name: '4 out of 5' })).toHaveAttribute('aria-checked', 'true');
    expect(within(movieStars).getByRole('radio', { name: '4 out of 5' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('CardRating feedback', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ ratings: {}, thumbs: {} });
  });

  const renderCard = () =>
    render(
      <ToastProvider>
        <MemoryRouter>
          <MovieCard movie={movie} delay={0} />
        </MemoryRouter>
      </ToastProvider>,
    );

  it('toasts on a card thumb and Undo restores the previous thumb', () => {
    state().setThumb(1000, 'down', { mediaType: 'movie', title: 'Neon Drift' }, 'movie');
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'I like Neon Drift' }));
    expect(selectThumbForTitle(1000, 'movie')(state())).toBe('up');
    expect(screen.getByText('Glad you liked Neon Drift')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(selectThumbForTitle(1000, 'movie')(state())).toBe('down');
  });

  it('toasts without Undo when a thumb is cleared', () => {
    state().setThumb(1000, 'up', { mediaType: 'movie', title: 'Neon Drift' }, 'movie');
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'I like Neon Drift' }));
    expect(selectThumbForTitle(1000, 'movie')(state())).toBeFalsy();
    expect(screen.getByText('Removed your thumb for Neon Drift')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
