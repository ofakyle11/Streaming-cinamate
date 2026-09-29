import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../components/ui';
import { createMockTmdb } from '../services/tmdb/mock';
import { selectThumbFor, useLastFrameStore } from '../state/store';
import Home from './Home';
import TitlePage from './TitlePage';

const T = { timeout: 3000 };
const state = () => useLastFrameStore.getState();

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home svc={createMockTmdb()} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Because you liked X', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ ratings: {}, thumbs: {}, watchlist: {} });
  });

  it('is absent until the profile likes something', async () => {
    renderHome();
    await screen.findByRole('heading', { level: 2, name: 'Trending Now' }, T);
    await waitFor(() => expect(screen.queryByRole('region', { name: /loading/ })).toBeNull(), T);
    expect(screen.queryByRole('heading', { name: /because you liked/i })).toBeNull();
  });

  it('builds a row from a liked title’s similar list, after Trending Now, hiding rated titles', async () => {
    state().setThumb(1000, 'up', { mediaType: 'movie', title: 'Neon Drift' });
    renderHome();

    const heading = await screen.findByRole('heading', { level: 2, name: 'Because you liked Neon Drift' }, T);
    const section = heading.closest('section') as HTMLElement;
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('Because you liked Neon Drift')).toBe(headings.indexOf('Trending Now') + 1);

    const links = within(section).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.getAttribute('href') === '/title/movie/1000')).toBe(false);

    // Thumbing a recommendation down removes it from the row immediately.
    const first = links[0];
    const card = first.closest('.card') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /not for me/i }));
    await waitFor(() => expect(within(section).queryByRole('link', { name: first.getAttribute('aria-label')! })).toBeNull());
  });

  it('keeps focus in the row when a card is thumbed away, with an Undo toast that restores it', async () => {
    state().setThumb(1000, 'up', { mediaType: 'movie', title: 'Neon Drift' });
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <Home svc={createMockTmdb()} />
        </MemoryRouter>
      </ToastProvider>,
    );
    const heading = await screen.findByRole('heading', { level: 2, name: 'Because you liked Neon Drift' }, T);
    const section = heading.closest('section') as HTMLElement;
    const first = within(section).getAllByRole('link')[0];
    const name = first.getAttribute('aria-label')!;
    const title = name.replace(/ \(\d{4}\)$/, '');
    const card = first.closest('.card') as HTMLElement;
    const like = within(card).getByRole('button', { name: `I like ${title}` });
    act(() => like.focus());
    fireEvent.click(like);

    expect(within(section).queryByRole('link', { name })).toBeNull();
    expect(section.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toHaveClass('card-link');
    expect(screen.getByText(`Glad you liked ${title}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await within(section).findByRole('link', { name })).toBeInTheDocument();
  });

  it('uses 4+ star ratings as seeds and resolves missing titles from the service', async () => {
    useLastFrameStore.setState({
      ratings: { [state().activeProfileId!]: [{ titleId: 1000, rating: 5, ratedAt: 1, mediaType: 'movie' }] },
    });
    renderHome();
    expect(await screen.findByRole('heading', { level: 2, name: 'Because you liked Neon Drift' }, T)).toBeInTheDocument();
  });
});

describe('Title page thumbs', () => {
  beforeEach(() => {
    useLastFrameStore.setState({ ratings: {}, thumbs: {} });
  });

  it('stores a thumbs-up for the title and confirms with a toast', async () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/title/movie/1000']}>
          <Routes>
            <Route path="/title/:type/:id" element={<TitlePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );
    const heading = await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }, T);
    const panel = heading.closest('article') as HTMLElement;
    fireEvent.click(within(panel).getByRole('button', { name: 'I like Neon Drift' }));
    expect(selectThumbFor(1000)(state())).toBe('up');
    expect(state().thumbs[state().activeProfileId!][0]).toMatchObject({ mediaType: 'movie', title: 'Neon Drift' });
    expect(await screen.findByText(/glad you liked neon drift/i)).toBeInTheDocument();
  });
});
