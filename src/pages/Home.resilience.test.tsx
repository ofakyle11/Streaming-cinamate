import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Movie, TmdbService } from '../services/types';
import { createMockTmdb } from '../services/tmdb/mock';

const T = { timeout: 3000 };

import Home from './Home';
import Hero from '../components/Hero';
import Row from '../components/Row';

const movie = (id: number, title: string): Movie => ({
  id,
  mediaType: 'movie',
  title,
  year: 2024,
  rating: 'PG-13',
  match: 90,
  genres: ['Drama'],
  description: 'A film.',
  poster: '',
  backdrop: '',
  runtime: 120,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Home resilience', () => {
  it('shows the error state and recovers on Try again', async () => {
    // Every catalogue call fails on the first attempt, then succeeds.
    const base = createMockTmdb();
    let fail = true;
    const guard =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      (...args: A): Promise<R> =>
        fail ? Promise.reject(new Error('TMDB 502')) : fn(...args);
    const svc: TmdbService = {
      ...base,
      trending: guard(base.trending),
      popular: guard(base.popular),
      topRated: guard(base.topRated),
      nowPlaying: guard(base.nowPlaying),
      discover: guard(base.discover),
      upcoming: guard(base.upcoming),
      byGenre: guard(base.byGenre),
      genres: guard(base.genres),
    };
    render(
      <MemoryRouter>
        <Home svc={svc} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /couldn’t load the catalogue/ }, T)).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('heading', { level: 1 }, T)).toBeInTheDocument();
    expect(screen.queryByText(/couldn’t load the catalogue/)).toBeNull();
  });
});

describe('Hero guards', () => {
  it('renders nothing for featured=[] without throwing', () => {
    const { container } = render(<Hero featured={[]} onMore={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not start the rotation interval for a single feature', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setInterval');
    render(<Hero featured={[movie(1, 'Solo')]} onMore={() => {}} />);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Solo' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('does not auto-advance under prefers-reduced-motion', () => {
    vi.useFakeTimers();
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduce') })) as typeof window.matchMedia;
    const spy = vi.spyOn(globalThis, 'setInterval');
    render(<Hero featured={[movie(1, 'A'), movie(2, 'B')]} onMore={() => {}} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    window.matchMedia = original;
  });
});

describe('Row without IntersectionObserver', () => {
  it('renders and becomes visible when IO is missing', () => {
    const io = window.IntersectionObserver;
    // @ts-expect-error -- simulate a browser without IntersectionObserver
    delete window.IntersectionObserver;
    try {
      const { container } = render(
        <MemoryRouter>
          <Row title="Shelf" items={[movie(1, 'A')]} onSelect={() => {}} />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { level: 2, name: 'Shelf' })).toBeInTheDocument();
      expect(container.querySelector('section.row')).toHaveClass('in');
    } finally {
      window.IntersectionObserver = io;
    }
  });
});
