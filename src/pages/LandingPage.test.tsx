import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockTmdb } from '../services/tmdb/mock';
import type { TmdbService } from '../services/types';
import { GUEST_KEY } from '../lib/guest';
import LandingPage from './LandingPage';

function renderLanding(svc: TmdbService = createMockTmdb()) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage svc={svc} />} />
        <Route path="/sign-in" element={<p>sign-in route</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('LandingPage', () => {
  it('renders the hero, value cards, steps and both calls to action', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Know where it streams/);
    expect(screen.getAllByRole('link', { name: /Get started|Create your account/ })).toHaveLength(
      2,
    );
    expect(screen.getByRole('button', { name: 'Browse as a guest' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Three answers, one place.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Where to watch' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Fit score' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'My List, everywhere' }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('.land-step')).toHaveLength(3);
  });

  it('links the sign-up calls to action to the sign-in flow', () => {
    renderLanding();
    for (const link of screen.getAllByRole('link', { name: /Get started|Create your account/ })) {
      expect(link).toHaveAttribute('href', '/sign-in?new=1');
    }
  });

  it('fills the poster wall from the catalogue service with fit chips', async () => {
    renderLanding();
    const wall = screen.getByTestId('landing-wall');
    expect(wall.querySelectorAll('.land-poster')).toHaveLength(9);
    await waitFor(() => expect(wall).toHaveClass('is-ready'), { timeout: 3000 });
    const posters = wall.querySelectorAll('.land-poster');
    expect(posters).toHaveLength(9);
    expect(wall.querySelectorAll('img')).toHaveLength(9);
    expect(wall.querySelectorAll('.land-poster-fit')[0]).toHaveTextContent(/^Fit \d+$/);
    expect(wall.querySelectorAll('.land-poster-title')[0]?.textContent).not.toBe('');
    // Decoration only: never read out by assistive tech, and no "match" or "Play" wording.
    expect(wall).toHaveAttribute('aria-hidden', 'true');
    expect(document.body.textContent).not.toMatch(/\bmatch\b|\bPlay\b|Cinamate/i);
  });

  it('keeps the tinted tiles when the catalogue fails', async () => {
    const failing = {
      ...createMockTmdb(),
      trending: () => Promise.reject(new Error('offline')),
    } as TmdbService;
    renderLanding(failing);
    const wall = screen.getByTestId('landing-wall');
    await waitFor(() => expect(wall).toHaveClass('is-error'));
    expect(wall.querySelectorAll('.land-poster')).toHaveLength(9);
    expect(wall.querySelectorAll('img')).toHaveLength(0);
  });

  it('remembers "Browse as a guest" on this device', () => {
    renderLanding();
    expect(window.localStorage.getItem(GUEST_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Browse as a guest' }));
    expect(window.localStorage.getItem(GUEST_KEY)).toBe('1');
  });

  it('sets the page meta and a large share card', async () => {
    renderLanding();
    await waitFor(() => expect(document.title).toBe('Find where to watch · Lastframe.tv'));
    const meta = (name: string, attr: 'name' | 'property' = 'name') =>
      document.head.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('og:image', 'property')).toMatch(/\/og-landing\.png$/);
  });
});
