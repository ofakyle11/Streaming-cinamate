import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie, TmdbVideo } from '../../services';
import { MOCK_VIDEOS } from '../../services/tmdb/mock';
import { selectWatchlist, useLastFrameStore } from '../../state/store';
import { ToastProvider } from '../ui';
import { FOCUSABLE_SELECTOR } from './titleUtils';
import TrailerModal from './TrailerModal';

const video = (over: Partial<TmdbVideo>): TmdbVideo => ({
  id: 'v',
  key: 'aqz-KE-bpKQ',
  name: 'Official Trailer',
  site: 'YouTube',
  type: 'Trailer',
  official: true,
  ...over,
});

function renderModal(v: TmdbVideo, onClose = vi.fn()) {
  render(
    <TrailerModal
      video={v}
      title="Neon Drift"
      poster="https://example.test/p.jpg"
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('TrailerModal', () => {
  it('embeds a real YouTube trailer from the mock fixtures on the privacy-enhanced domain', () => {
    const yt = MOCK_VIDEOS[1000].find((v) => v.site === 'YouTube')!;
    renderModal(yt);
    const frame = screen.getByTitle('Neon Drift trailer');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toMatch(
      new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${yt.key}\\?`),
    );
    expect(screen.queryByText(/can’t be played here/i)).not.toBeInTheDocument();
  });

  it.each([
    ['an unsupported site', video({ site: 'Dailymotion', key: 'x8abc12' })],
    ['an unsafe key', video({ key: '../evil?x=1' })],
  ])('falls back to a placeholder card for %s', (_label, v) => {
    renderModal(v);
    expect(screen.queryByTitle('Neon Drift trailer')).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/can’t be played here/i)).toBeInTheDocument();
  });

  it('renders as a sheet (drag-to-dismiss target) inside the modal backdrop', () => {
    renderModal(video({}));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('sheet');
    expect(dialog.parentElement).toHaveClass('modal-backdrop');
  });

  it('closes via the close button and on backdrop click, not on dialog click', () => {
    const onClose = renderModal(video({}));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close trailer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

const MOVIE: Movie = {
  id: 1002,
  mediaType: 'tv',
  title: 'Midnight Protocol',
  year: 2017,
  rating: 'TV-MA',
  match: 88,
  genres: ['Thriller'],
  description: 'A night-shift dispatcher.',
  poster: '/p.jpg',
  backdrop: '/b.jpg',
  runtime: 42,
};

const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

describe('TrailerModal footer (My List + thumbs)', () => {
  beforeEach(() => useLastFrameStore.setState({ watchlist: {}, thumbs: {} }));

  function renderWithMovie(onClose = vi.fn(), onThumbChange = vi.fn()) {
    render(
      <ToastProvider>
        <TrailerModal
          video={video({ site: 'Dailymotion' })}
          title={MOVIE.title}
          poster=""
          onClose={onClose}
          movie={MOVIE}
          onThumbChange={onThumbChange}
        />
      </ToastProvider>,
    );
    return { onClose, onThumbChange };
  }

  it('renders no footer without a movie', () => {
    renderModal(video({}));
    expect(screen.queryByRole('button', { name: /my list/i })).toBeNull();
    expect(screen.queryByRole('group', { name: /thumbs/i })).toBeNull();
  });

  it('toggles My List in the store with a toast, without closing', () => {
    const { onClose } = renderWithMovie();
    const dialog = screen.getByRole('dialog');
    const add = within(dialog).getByRole('button', { name: 'Add Midnight Protocol to My List' });
    expect(add).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(add);
    expect(selectWatchlist(useLastFrameStore.getState())).toMatchObject([
      { titleId: 1002, mediaType: 'tv' },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Added Midnight Protocol to My List');

    const remove = within(dialog).getByRole('button', {
      name: 'Remove Midnight Protocol from My List',
    });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(remove);
    expect(selectWatchlist(useLastFrameStore.getState())).toEqual([]);
    expect(screen.getByText('Removed Midnight Protocol from My List')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('footer thumbs update the store and report changes', () => {
    const { onThumbChange } = renderWithMovie();
    fireEvent.click(screen.getByRole('button', { name: 'I like Midnight Protocol' }));
    expect(onThumbChange).toHaveBeenCalledWith('up');
    expect(screen.getByRole('button', { name: 'I like Midnight Protocol' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Tab cycles through the close button and the footer controls', () => {
    renderWithMovie();
    const close = screen.getByRole('button', { name: /close trailer/i });
    const list = screen.getByRole('button', { name: /add midnight protocol to my list/i });
    const up = screen.getByRole('button', { name: 'I like Midnight Protocol' });
    const down = screen.getByRole('button', { name: 'Not for me: Midnight Protocol' });
    expect(close).toHaveFocus();

    // The trap sees every footer control, in DOM order.
    expect(Array.from(screen.getByRole('dialog').querySelectorAll(FOCUSABLE_SELECTOR))).toEqual([
      close,
      list,
      up,
      down,
    ]);

    // The browser moves focus between middle controls natively; the trap wraps at the ends.
    tab(true);
    expect(down).toHaveFocus();
    tab();
    expect(close).toHaveFocus();
  });

  it('the trap selector includes tabindex elements and selects, but not tabindex=-1', () => {
    const host = document.createElement('div');
    const ok = document.createElement('div');
    ok.tabIndex = 0;
    const skip = document.createElement('div');
    skip.tabIndex = -1;
    const sel = document.createElement('select');
    host.append(ok, skip, sel);
    expect(Array.from(host.querySelectorAll(FOCUSABLE_SELECTOR))).toEqual([ok, sel]);
  });

  it('Escape closes and restores focus to the opener', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <ToastProvider>
          <button type="button" onClick={() => setOpen(true)}>
            Watch trailer
          </button>
          {open && (
            <TrailerModal
              video={video({})}
              title={MOVIE.title}
              poster=""
              onClose={() => setOpen(false)}
              movie={MOVIE}
            />
          )}
        </ToastProvider>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Watch trailer' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('button', { name: /close trailer/i })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
