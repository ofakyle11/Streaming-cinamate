import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { Link, MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteAnnouncer from './RouteAnnouncer';

function Page({ title, modal = false }: { title: string; modal?: boolean }) {
  useEffect(() => {
    document.title = `${title} · Lastframe.tv`;
  }, [title]);
  const navigate = useNavigate();
  return (
    <main>
      <h1>{title}</h1>
      <Link to="/search">Go to search</Link>
      <Link to="/">Go home</Link>
      <Link to="/late">Go late</Link>
      <button type="button" onClick={() => navigate('/#section')}>
        Hash only
      </button>
      {modal && (
        <div role="dialog" aria-modal="true" aria-label="Details">
          <button type="button">Inside modal</button>
        </div>
      )}
    </main>
  );
}

function Layout() {
  return (
    <>
      <div id="main" tabIndex={-1}>
        <Outlet />
      </div>
      <RouteAnnouncer />
    </>
  );
}

function renderApp(initial = '/', modalOnSearch = false) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Page title="Home" />} />
          <Route path="/search" element={<Page title="Search" modal={modalOnSearch} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

async function flushTick() {
  await act(async () => {
    vi.runAllTimers();
  });
}

describe('RouteAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a polite status region and says nothing on the initial mount', async () => {
    renderApp();
    await flushTick();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('');
    expect(document.activeElement).not.toBe(document.getElementById('main'));
  });

  it('announces the new title and moves focus to #main after navigation', async () => {
    renderApp();
    const link = screen.getByRole('link', { name: 'Go to search' });
    act(() => link.focus());
    fireEvent.click(link);
    await flushTick();
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Navigated to Search · Lastframe.tv');
    expect(document.activeElement).toBe(document.getElementById('main'));

    fireEvent.click(screen.getByRole('link', { name: 'Go home' }));
    await flushTick();
    expect(screen.getByRole('status')).toHaveTextContent('Navigated to Home · Lastframe.tv');
  });

  it('waits for a late title (lazy route) before announcing', async () => {
    function LatePage() {
      useEffect(() => {
        const t = window.setTimeout(() => {
          document.title = 'Late · Lastframe.tv';
        }, 300);
        return () => window.clearTimeout(t);
      }, []);
      return <h1>Late</h1>;
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Page title="Home" />} />
            <Route path="/late" element={<LatePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Go late' }));
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    // Title not updated yet: focus is reset but nothing stale is announced.
    expect(document.activeElement).toBe(document.getElementById('main'));
    expect(screen.getByRole('status')).toHaveTextContent('');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Navigated to Late · Lastframe.tv');
  });

  it('ignores hash-only changes', async () => {
    renderApp();
    const button = screen.getByRole('button', { name: 'Hash only' });
    act(() => button.focus());
    fireEvent.click(button);
    await flushTick();
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(document.activeElement).toBe(button);
  });

  it('announces but does not steal focus while a modal dialog is open', async () => {
    renderApp('/', true);
    fireEvent.click(screen.getByRole('link', { name: 'Go to search' }));
    const inside = screen.getByRole('button', { name: 'Inside modal' });
    act(() => inside.focus());
    await flushTick();
    expect(screen.getByRole('status')).toHaveTextContent('Navigated to Search · Lastframe.tv');
    expect(document.activeElement).toBe(inside);
  });
});
