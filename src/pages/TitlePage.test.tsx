import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import TitlePage from './TitlePage';
import { createMockTmdb } from '../services/tmdb/mock';

const T = { timeout: 3000 };

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/title/:type/:id" element={<TitlePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TitlePage', () => {
  it('renders a TV title found via search (not only home-catalogue items)', async () => {
    const { results } = await createMockTmdb().search('the', 1, { mediaType: 'tv' });
    // Pick the last hit so it is unlikely to be one of the home rows.
    const hit = results[results.length - 1];
    renderAt(`/title/tv/${hit.id}`);
    expect(await screen.findByRole('heading', { name: hit.name }, T)).toBeInTheDocument();
    expect(screen.queryByText('Title not found')).not.toBeInTheDocument();
  });

  it('shows not found for an unknown id', async () => {
    renderAt('/title/movie/987654');
    expect(await screen.findByRole('heading', { name: 'Title not found' }, T)).toBeInTheDocument();
  });

  it('shows not found for a bad type', async () => {
    renderAt('/title/person/1000');
    expect(await screen.findByRole('heading', { name: 'Title not found' }, T)).toBeInTheDocument();
  });
});
