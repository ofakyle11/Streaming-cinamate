import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Navbar from './Navbar';
import SearchPage from '../pages/SearchPage';
import NewPopularPage from '../pages/NewPopularPage';
import GenrePage from '../pages/GenrePage';
import { createMockTmdb } from '../services/tmdb/mock';

const T = { timeout: 3000 };

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderAt(url: string) {
  const svc = createMockTmdb();
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Navbar />
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/search" element={<SearchPage svc={svc} />} />
        <Route path="/new" element={<NewPopularPage svc={svc} />} />
        <Route path="/genre/:id" element={<GenrePage />} />
        <Route path="/my-list" element={<p>my list</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

/** The site navbar is the first navigation landmark. */
const nav = () => within(screen.getAllByRole('navigation')[0]);

describe('Navbar discovery links', () => {
  it.each([
    ['Series', '/search?type=tv'],
    ['Films', '/search?type=movie'],
    ['New & Popular', '/new'],
  ])('%s lands on a working page', async (label, href) => {
    renderAt('/');
    const link = nav().getByRole('link', { name: label });
    expect(link).toHaveAttribute('href', href);
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(href), T);
    // Wait for titles to load, then make sure it is not the genre 404.
    await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0), T);
    expect(screen.queryByRole('heading', { name: /genre not found/i })).toBeNull();
  });

  it('Series preselects the TV filter on the search page', async () => {
    renderAt('/search?type=tv');
    expect(await screen.findByRole('button', { name: 'TV', pressed: true }, T)).toBeInTheDocument();
  });

  it('highlights only the matching link on /search?type=tv', () => {
    renderAt('/search?type=tv');
    const series = nav().getByRole('link', { name: 'Series' });
    const films = nav().getByRole('link', { name: 'Films' });
    expect(series).toHaveClass('active');
    expect(series).toHaveAttribute('aria-current', 'page');
    expect(films).not.toHaveClass('active');
    expect(films).not.toHaveAttribute('aria-current', 'page');
    expect(nav().getByRole('link', { name: 'Home' })).not.toHaveClass('active');
    expect(nav().getByRole('link', { name: 'New & Popular' })).not.toHaveClass('active');
  });

  it('highlights Films on /search?type=movie and neither on a plain search', () => {
    const { unmount } = renderAt('/search?type=movie');
    expect(nav().getByRole('link', { name: 'Films' })).toHaveClass('active');
    expect(nav().getByRole('link', { name: 'Series' })).not.toHaveClass('active');
    unmount();
    renderAt('/search?q=neon');
    expect(nav().getByRole('link', { name: 'Films' })).not.toHaveClass('active');
    expect(nav().getByRole('link', { name: 'Series' })).not.toHaveClass('active');
  });

  it('highlights New & Popular on /new', () => {
    renderAt('/new');
    expect(nav().getByRole('link', { name: 'New & Popular' })).toHaveClass('active');
  });
});
