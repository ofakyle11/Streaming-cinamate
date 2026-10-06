import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Navbar from './Navbar';
import { AuthProvider } from '../auth';
import { createMockAuth } from '../services/auth/mock';
import { vi } from 'vitest';
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
    await waitFor(
      () => expect(screen.getAllByRole('link', { name: /\(\d{4}\)$/ }).length).toBeGreaterThan(0),
      T,
    );
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

describe('Navbar Lumen hooks', () => {
  it('marks the logo link as the header logo slot', () => {
    renderAt('/');
    expect(nav().getByRole('link', { name: 'Lastframe.tv home' })).toHaveAttribute(
      'data-logo-slot',
      'header',
    );
  });

  it('renders every nav link with the view transition enabled', async () => {
    renderAt('/');
    for (const name of ['Home', 'Series', 'Films', 'New & Popular', 'My List']) {
      expect(nav().getByRole('link', { name })).toBeInTheDocument();
    }
    // A viewTransition navigation still lands (jsdom has no startViewTransition).
    fireEvent.click(nav().getByRole('link', { name: 'My List' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/my-list'), T);
  });
});

function renderNavbarMenu(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navbar />
      <Routes>
        <Route path="*" element={<div data-testid="page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const toggle = () => screen.getByRole('button', { name: 'Menu' });
const menuList = () => document.getElementById(toggle().getAttribute('aria-controls') ?? '');

describe('Navbar mobile menu', () => {
  it('toggles aria-expanded and controls the links list', () => {
    renderNavbarMenu();
    const button = toggle();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const list = menuList();
    expect(list).not.toBeNull();
    expect(list).not.toHaveClass('is-open');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(list).toHaveClass('is-open');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toHaveClass('is-open');
  });

  it('renders the primary links when open', () => {
    renderNavbarMenu();
    fireEvent.click(toggle());
    const list = menuList() as HTMLElement;
    expect(list).toHaveClass('is-open');
    expect(list.querySelectorAll('a')).toHaveLength(5);
    for (const name of ['Home', 'Series', 'Films', 'New & Popular', 'My List']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('closes on Escape and restores focus to the toggle', () => {
    renderNavbarMenu();
    const button = toggle();
    fireEvent.click(button);
    screen.getByRole('link', { name: 'Films' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on an outside click and restores focus to the toggle', () => {
    renderNavbarMenu();
    const button = toggle();
    fireEvent.click(button);
    fireEvent.mouseDown(screen.getByTestId('page'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes when a link is clicked', () => {
    renderNavbarMenu('/');
    const button = toggle();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('link', { name: 'Series' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Series' })).toHaveClass('active');
  });
});

describe('Navbar signed-out state', () => {
  const renderWithAuth = async (service = createMockAuth(), url = '/my-list') => {
    render(
      <AuthProvider service={service} mode="mock" clearLocal={vi.fn()} startSync={null}>
        <MemoryRouter initialEntries={[url]}>
          <Navbar />
        </MemoryRouter>
      </AuthProvider>,
    );
  };

  it('offers Sign in and Get started to guests, returning to the current page', async () => {
    await renderWithAuth();
    const signIn = await nav().findByRole('link', { name: 'Sign in' });
    expect(signIn).toHaveAttribute('href', '/sign-in?returnTo=%2Fmy-list');
    expect(nav().getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/sign-in?new=1&returnTo=%2Fmy-list',
    );
    expect(nav().queryByRole('button', { name: /switch profile/i })).toBeNull();
  });

  it('hides the buttons on the sign-in pages themselves', async () => {
    await renderWithAuth(createMockAuth(), '/sign-in?returnTo=%2Fmy-list');
    await waitFor(() => expect(nav().queryByRole('link', { name: 'Sign in' })).toBeNull());
    expect(nav().queryByRole('link', { name: 'Get started' })).toBeNull();
  });

  it('shows the profile menu to members', async () => {
    const service = createMockAuth();
    await service.signInWithMagicLink('ada@example.com');
    await renderWithAuth(service);
    expect(await nav().findByRole('button', { name: /switch profile/i })).toBeInTheDocument();
    expect(nav().queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('keeps the profile menu without an auth provider', () => {
    renderAt('/');
    expect(nav().getByRole('button', { name: /switch profile/i })).toBeInTheDocument();
  });
});
