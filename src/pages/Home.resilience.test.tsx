import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '../services/types';

const T = { timeout: 3000 };

const { loadSafe } = vi.hoisted(() => ({ loadSafe: vi.fn() }));
vi.mock('../services/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/discovery')>();
  return { ...actual, loadHomeCatalogSafe: loadSafe };
});

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
  loadSafe.mockReset();
  vi.useRealTimers();
});

describe('Home resilience', () => {
  it('shows the error state and recovers on Try again', async () => {
    loadSafe
      .mockRejectedValueOnce(new Error('TMDB 502'))
      .mockResolvedValueOnce({ featured: [movie(1, 'Recovered')], rows: [{ title: 'Trending Now', items: [movie(1, 'Recovered')] }] });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(await screen.findByText('TMDB 502', undefined, T)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Trending Now' }, T)).toBeInTheDocument();
    expect(screen.queryByText('TMDB 502')).toBeNull();
    expect(loadSafe).toHaveBeenCalledTimes(2);
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
      const { container } = render(<Row title="Shelf" items={[movie(1, 'A')]} onSelect={() => {}} />);
      expect(screen.getByRole('heading', { level: 2, name: 'Shelf' })).toBeInTheDocument();
      expect(container.querySelector('section.row')).toHaveClass('in');
    } finally {
      window.IntersectionObserver = io;
    }
  });
});
