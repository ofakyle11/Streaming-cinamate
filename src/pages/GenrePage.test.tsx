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
    expect(screen.getAllByRole('link', { name: /\(\d{4}\)$/ }).length).toBeGreaterThan(0);
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

  it('switches between movie and TV results via the media type control', async () => {
    renderAt('/genre/878');
    await screen.findByRole('heading', { level: 1, name: 'Science Fiction' });
    // Neon Drift is a sci-fi movie; Signal Lost is a sci-fi series.
    expect(await screen.findByText('Neon Drift')).toBeInTheDocument();
    expect(screen.queryByText('Signal Lost')).not.toBeInTheDocument();
    const group = await screen.findByRole('group', { name: /media type/i });
    expect(within(group).getByRole('button', { name: 'Movies' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'TV' }));
    expect(await screen.findByText('Signal Lost')).toBeInTheDocument();
    expect(screen.queryByText('Neon Drift')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: /media type/i })).getByRole('button', { name: 'TV' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('hides the media type control for single-type genres', async () => {
    renderAt('/genre/99');
    await screen.findByRole('heading', { level: 1, name: 'Documentary' });
    await screen.findByText('Deep Field');
    expect(screen.queryByRole('group', { name: /media type/i })).not.toBeInTheDocument();
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
