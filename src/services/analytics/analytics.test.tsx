import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { analytics, services } from '../index';
import { AnalyticsEvents, track, trackPage } from './track';
import { usePageViews } from '../../hooks/usePageViews';
import { createMockAnalytics } from './mock';
import SearchPage from '../../pages/SearchPage';
import GenrePage from '../../pages/GenrePage';
import TrailerModal from '../../components/title/TrailerModal';
import TitlePage from '../../pages/TitlePage';
import { ToastProvider } from '../../components/ui';
import { useLastFrameStore } from '../../state/store';
import { createMockTmdb } from '../tmdb/mock';
import type { Movie } from '../types';

const T = { timeout: 3000 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('service locator', () => {
  it('uses the mock analytics adapter with no env vars', () => {
    expect(services.mode.analytics).toBe('mock');
  });

  it('switches to plausible when VITE_PLAUSIBLE_DOMAIN is set', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'lastframe.tv');
    vi.resetModules();
    const mod = await import('../index');
    expect(mod.services.mode.analytics).toBe('live');
  });
});

describe('mock adapter', () => {
  it('logs to console only when debug is on', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    createMockAnalytics({ debug: false }).track('search');
    expect(spy).not.toHaveBeenCalled();
    const m = createMockAnalytics({ debug: true });
    m.page('/', { path: '/' });
    expect(spy).toHaveBeenCalledWith('[analytics:page]', '/', expect.objectContaining({ path: '/' }));
    expect(m.events()).toHaveLength(1);
  });
});

describe('track helpers', () => {
  it('forward to the active adapter', () => {
    const t = vi.spyOn(analytics, 'track');
    const p = vi.spyOn(analytics, 'page');
    track(AnalyticsEvents.addToList, { id: 1 });
    trackPage('/x', { path: '/x' });
    expect(t).toHaveBeenCalledWith('add-to-list', { id: 1 });
    expect(p).toHaveBeenCalledWith('/x', { path: '/x' });
  });

  it('never throw', () => {
    vi.spyOn(analytics, 'track').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => track(AnalyticsEvents.search)).not.toThrow();
  });
});

describe('usePageViews', () => {
  it('emits a page view on mount and on each route change', () => {
    const page = vi.spyOn(analytics, 'page').mockImplementation(() => {});
    let go: (to: string) => void = () => {};
    function Probe() {
      usePageViews();
      go = useNavigate();
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(page).toHaveBeenLastCalledWith('/', { path: '/' });
    act(() => go('/search?q=dune'));
    expect(page).toHaveBeenLastCalledWith('/search', { path: '/search?q=dune' });
    act(() => go('/search?q=dune'));
    expect(page).toHaveBeenCalledTimes(2);
  });
});

describe('mock page de-dupe', () => {
  it('skips a page whose path matches the previous page view', () => {
    const m = createMockAnalytics({ debug: false });
    m.page('/search', { path: '/search?q=x' });
    m.page('/search', { path: '/search?q=x' });
    m.page('/', { path: '/' });
    m.page('/search', { path: '/search?q=x' });
    expect(m.events().map((e) => e.props?.path)).toEqual(['/search?q=x', '/', '/search?q=x']);
  });

  it('does not de-dupe pages without a path', () => {
    const m = createMockAnalytics({ debug: false });
    m.page('home');
    m.page('home');
    expect(m.events()).toHaveLength(2);
  });
});

describe('page views through the app router', () => {
  it('records exactly one page event for /search?q=x', async () => {
    window.history.pushState({}, '', '/search?q=x');
    vi.resetModules();
    const svc = await import('../index');
    const mock = svc.analytics as ReturnType<typeof createMockAnalytics>;
    const { default: AppRouter } = await import('../../app/router');
    render(
      <StrictMode>
        <AppRouter />
      </StrictMode>,
    );
    await screen.findByLabelText('Search titles', { selector: '#search-input' }, T);
    await waitFor(() => expect(mock.events().some((e) => e.type === 'track' && e.name === 'search')).toBe(true), T);
    const pages = mock.events().filter((e) => e.type === 'page');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ name: '/search', props: { path: '/search?q=x' } });
    window.history.pushState({}, '', '/');
  });
});

describe('title-open events', () => {
  it('fires from Search with source "search"', async () => {
    const t = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/search?q=neon']}>
        <Routes>
          <Route path="/search" element={<SearchPage svc={createMockTmdb()} />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('link', { name: /^Neon Drift/i }, T));
    expect(t).toHaveBeenCalledWith(
      AnalyticsEvents.titleOpen,
      expect.objectContaining({ id: expect.any(Number), mediaType: expect.any(String), source: 'search' }),
    );
    expect(t).not.toHaveBeenCalledWith('title_open', expect.anything());
  });

  it('fires from Genre with source "genre"', async () => {
    const t = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/genre/878']}>
        <Routes>
          <Route path="/genre/:id" element={<GenrePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Science Fiction' }, T);
    const card = screen.getAllByRole('link').find((b) => b.classList.contains('card-link'));
    expect(card).toBeDefined();
    fireEvent.click(card as HTMLElement);
    expect(t).toHaveBeenCalledWith(
      AnalyticsEvents.titleOpen,
      expect.objectContaining({ id: expect.any(Number), mediaType: expect.any(String), source: 'genre', genreId: 878 }),
    );
  });
});

describe('title-open from New & Popular', () => {
  it('records exactly one typed title-open with source "new" through the mock adapter', async () => {
    vi.resetModules();
    const svc = await import('../index');
    const mock = svc.analytics as ReturnType<typeof createMockAnalytics>;
    const { default: NewPopularPage } = await import('../../pages/NewPopularPage');
    const { createMockTmdb: freshMockTmdb } = await import('../tmdb/mock');
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={<NewPopularPage svc={freshMockTmdb()} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByRole('link').some((b) => b.classList.contains('card-link'))).toBe(true), T);
    const card = screen.getAllByRole('link').find((b) => b.classList.contains('card-link'));
    fireEvent.click(card as HTMLElement);
    const tracks = mock.events().filter((e) => e.type === 'track');
    const opens = tracks.filter((e) => e.name === AnalyticsEvents.titleOpen);
    expect(opens).toHaveLength(1);
    expect(opens[0].props).toMatchObject({ id: expect.any(Number), mediaType: expect.any(String), source: 'new' });
    expect(opens[0].props).not.toHaveProperty('from');
    expect(tracks.some((e) => e.name === 'title_open')).toBe(false);
  });
});

describe('title action events (trailer + My List)', () => {
  const movie: Movie = {
    id: 42,
    mediaType: 'movie',
    title: 'Test Title',
    year: 2024,
    rating: 'PG-13',
    match: 90,
    genres: ['Drama'],
    description: 'A test.',
    poster: '',
    backdrop: '',
  } as unknown as Movie;

  it('emits add-to-list from the trailer modal footer', () => {
    useLastFrameStore.setState({ watchlist: {} });
    const t = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    render(
      <ToastProvider>
        <TrailerModal
          video={{ id: 'v', key: 'aqz-KE-bpKQ', name: 'Trailer', site: 'YouTube', type: 'Trailer' }}
          title={movie.title}
          poster=""
          onClose={() => {}}
          movie={movie}
        />
      </ToastProvider>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /My List/ }));
    expect(t).toHaveBeenLastCalledWith(
      AnalyticsEvents.addToList,
      expect.objectContaining({ id: 42, mediaType: 'movie', list: 'watchlist' }),
    );
  });

  it('emits play-trailer from the title page', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const t = vi.spyOn(analytics, 'track').mockImplementation(() => {});
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/title/movie/1000']}>
          <Routes>
            <Route path="/title/:type/:id" element={<TitlePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );
    const play = await screen.findByRole('button', { name: /Play trailer/ }, T);
    fireEvent.click(play);
    expect(t).toHaveBeenCalledWith(
      AnalyticsEvents.playTrailer,
      expect.objectContaining({ id: 1000, mediaType: 'movie' }),
    );
  });
});
