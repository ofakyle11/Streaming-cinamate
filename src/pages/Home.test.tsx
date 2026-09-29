import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Services from '../services';
import Home from './Home';

const { loadHomeCatalog, realLoad } = vi.hoisted(() => ({
  loadHomeCatalog: vi.fn(),
  realLoad: { fn: null as null | typeof Services.loadHomeCatalog },
}));

vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof Services>();
  realLoad.fn = actual.loadHomeCatalog;
  return { ...actual, loadHomeCatalog };
});

// withRetry only retries transient failures; fetch rejects with a TypeError offline.
const networkError = () => new TypeError('Failed to fetch');

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe('Home load states', () => {
  beforeEach(() => {
    loadHomeCatalog.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a busy glass status card while loading', () => {
    loadHomeCatalog.mockReturnValue(new Promise(() => {}));
    renderHome();
    const status = screen.getByRole('status');
    expect(status).toHaveClass('hero-card', 'glass');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('retries, then shows the ErrorCard, and Try again reloads the rows', async () => {
    loadHomeCatalog.mockRejectedValue(networkError());
    renderHome();

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(loadHomeCatalog).toHaveBeenCalledTimes(3);
    expect(alert).toHaveAccessibleName("Couldn't load the catalogue");
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // ErrorCard owns the only <main>; it is not nested inside another.
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(within(alert).queryByRole('link', { name: /go home/i })).not.toBeInTheDocument();

    loadHomeCatalog.mockImplementation(() => realLoad.fn!());
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: /trending now/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }, 10000);

  it('says so when the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    loadHomeCatalog.mockRejectedValue(networkError());
    renderHome();
    expect(
      await screen.findByText(
        'You appear to be offline. Reconnect and try again.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  }, 10000);

  it('puts the hero h1 inside the main landmark', async () => {
    loadHomeCatalog.mockImplementation(() => realLoad.fn!());
    renderHome();
    const h1 = await screen.findByRole('heading', { level: 1 });
    const main = screen.getByRole('main');
    expect(main).toContainElement(h1);
    expect(main).toContainElement(screen.getByRole('heading', { level: 2, name: /trending now/i }));
  });
});
