import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import GenrePage from './GenrePage';
import GenreChips from '../components/GenreChips';
import { createMockTmdb } from '../services/tmdb/mock';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/genre/:id" element={<GenrePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('GenrePage', () => {
  it('renders the genre name and a grid of titles', async () => {
    renderAt('/genre/878');
    expect(await screen.findByRole('heading', { level: 1, name: 'Science Fiction' })).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('switches sort via the sort control', async () => {
    renderAt('/genre/18');
    await screen.findByRole('heading', { level: 1, name: 'Drama' });
    const group = screen.getByRole('group', { name: /sort titles/i });
    expect(within(group).getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(group).getByRole('button', { name: 'Newest' }));
    expect(within(group).getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('heading', { level: 1, name: 'Drama' })).toBeInTheDocument();
  });

  it('shows not found for unknown genres', async () => {
    renderAt('/genre/999999');
    expect(await screen.findByRole('heading', { name: /genre not found/i })).toBeInTheDocument();
  });
});

describe('GenreChips', () => {
  it('links each genre to /genre/:id', async () => {
    render(
      <MemoryRouter>
        <GenreChips svc={createMockTmdb()} />
      </MemoryRouter>,
    );
    const link = await screen.findByRole('link', { name: 'Action' });
    expect(link).toHaveAttribute('href', '/genre/28');
  });
});
