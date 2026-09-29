import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NewPopularPage from './NewPopularPage';
import { createMockTmdb } from '../services/tmdb/mock';
import type { TmdbService } from '../services/types';

const T = { timeout: 3000 };

const renderPage = (svc: TmdbService) =>
  render(
    <MemoryRouter initialEntries={['/new']}>
      <NewPopularPage svc={svc} />
    </MemoryRouter>,
  );

describe('NewPopularPage', () => {
  it('renders its rows', async () => {
    renderPage(createMockTmdb());
    expect(screen.getByRole('heading', { level: 1, name: 'New & Popular' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    for (const name of ['Trending This Week', 'Coming Soon', 'Now Playing', 'Popular TV']) {
      expect(await screen.findByRole('heading', { level: 2, name }, T)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('opens the detail modal on select', async () => {
    renderPage(createMockTmdb());
    await screen.findByRole('heading', { level: 2, name: 'Trending This Week' }, T);
    const [first] = screen.getAllByRole('img');
    fireEvent.click(first.closest('button') as HTMLButtonElement);
    expect(await screen.findByRole('dialog', undefined, T)).toBeInTheDocument();
  });

  it('shows an error and retries', async () => {
    const base = createMockTmdb();
    let fail = true;
    const svc: TmdbService = {
      ...base,
      upcoming: (p) => (fail ? Promise.reject(new Error('Network down')) : base.upcoming(p)),
    };
    renderPage(svc);
    expect(await screen.findByRole('alert', undefined, T)).toHaveTextContent('Network down');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Coming Soon' }, T)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
