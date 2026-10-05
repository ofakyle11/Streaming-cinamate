import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchPage from './SearchPage';
import Navbar from '../components/Navbar';
import { createMockTmdb } from '../services/tmdb/mock';
import type { TmdbService } from '../services/types';

const T = { timeout: 3000 };

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderAt(url: string, svc: TmdbService = createMockTmdb()) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Navbar />
      <Routes>
        <Route path="/search" element={<SearchPage svc={svc} />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const cards = () => within(screen.getByRole('list', { name: 'Search results' })).queryAllByRole('listitem');

describe('SearchPage', () => {
  const OriginalIO = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = OriginalIO;
    vi.useRealTimers();
  });

  it('shows results for ?q=', async () => {
    renderAt('/search?q=neon');
    expect(await screen.findByRole('link', { name: /^Neon Drift/i }, T)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Results for “neon”/ })).toBeInTheDocument();
  });

  it('debounces typing into the URL', async () => {
    renderAt('/search');
    const input = screen.getByLabelText('Search titles', { selector: '#search-input' });
    fireEvent.change(input, { target: { value: 'orb' } });
    // Not written immediately.
    expect(screen.getByTestId('location').textContent).toBe('/search');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/search?q=orb'), T);
    expect(await screen.findByRole('link', { name: /^Silent Orbit/i }, T)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Orbital Drift/i })).toBeInTheDocument();
  });

  it('applies the type chip filter', async () => {
    renderAt('/search?q=orb');
    await screen.findByRole('link', { name: /^Silent Orbit/i }, T);
    fireEvent.click(screen.getByRole('button', { name: 'TV' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('type=tv'), T);
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Silent Orbit/i })).toBeNull(), T);
    expect(await screen.findByRole('link', { name: /^Orbital Drift/i }, T)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TV' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty state', async () => {
    renderAt('/search?q=zzzzqqq');
    expect(await screen.findByText(/No titles match “zzzzqqq”/, undefined, T)).toBeInTheDocument();
  });

  it('shows an error state and retries', async () => {
    const base = createMockTmdb();
    let fail = true;
    const svc: TmdbService = {
      ...base,
      search: (q, p) => (fail ? Promise.reject(new Error('Network down')) : base.search(q, p)),
    };
    renderAt('/search?q=neon', svc);
    expect(await screen.findByRole('alert', undefined, T)).toHaveTextContent('Network down');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /^Neon Drift/i }, T)).toBeInTheDocument();
  });

  it('loads the next page when the sentinel intersects', async () => {
    const callbacks: IntersectionObserverCallback[] = [];
    class CapturingIO {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: ReadonlyArray<number> = [];
      constructor(cb: IntersectionObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    globalThis.IntersectionObserver = CapturingIO as unknown as typeof IntersectionObserver;
    renderAt('/search');
    // Browse merges movie + TV discover pages: 20 + 20 on page 1.
    await waitFor(() => expect(cards()).toHaveLength(40), T);
    await waitFor(() => expect(screen.getByTestId('search-sentinel')).toBeInTheDocument(), T);
    act(() => {
      callbacks[callbacks.length - 1](
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await waitFor(() => expect(cards()).toHaveLength(60), T);
  });

  it('falls back to a Load more button without IntersectionObserver', async () => {
    // Simulate an environment without IntersectionObserver.
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    renderAt('/search');
    await waitFor(() => expect(cards()).toHaveLength(40), T);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }, T));
    await waitFor(() => expect(cards()).toHaveLength(60), T);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull(), T);
  });

  it('navbar search navigates to /search?q=', async () => {
    renderAt('/elsewhere');
    const navInput = screen.getByRole('searchbox', { name: 'Search titles' });
    fireEvent.change(navInput, { target: { value: 'glass' } });
    fireEvent.submit(navInput.closest('form') as HTMLFormElement);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/search?q=glass'), T);
    expect(await screen.findByRole('link', { name: /^The Glass Horizon/i }, T)).toBeInTheDocument();
    expect((screen.getByLabelText('Search titles', { selector: '#search-input' }) as HTMLInputElement).value).toBe(
      'glass',
    );
  });
});
