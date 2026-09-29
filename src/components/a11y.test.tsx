import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Movie, TmdbVideo } from '../services';
import Row from './Row';
import TrailerModal from './title/TrailerModal';

const movie = (id: number, title: string): Movie => ({
  id,
  mediaType: 'movie',
  title,
  year: 2020 + id,
  rating: '13+',
  match: 90,
  genres: ['Drama'],
  description: `About ${title}`,
  poster: '',
  backdrop: '',
  runtime: 100,
});

const items = [movie(1, 'Alpha'), movie(2, 'Bravo'), movie(3, 'Charlie')];

describe('Row keyboard navigation', () => {
  it('exposes a labelled region with one tab stop and arrow-key movement', () => {
    render(
      <MemoryRouter>
        <Row title="Trending" items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: 'Trending' })).toBeInTheDocument();
    const cards = screen.getAllByRole('link', { name: /Alpha|Bravo|Charlie/ });
    expect(cards.map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    act(() => cards[0].focus());
    fireEvent.keyDown(cards[0], { key: 'ArrowRight' });
    expect(cards[1]).toHaveFocus();
    fireEvent.keyDown(cards[1], { key: 'End' });
    expect(cards[2]).toHaveFocus();
    fireEvent.keyDown(cards[2], { key: 'Home' });
    expect(cards[0]).toHaveFocus();
  });
});

// DetailModal was removed in favour of the title page + TrailerModal; the same
// modal-dialog guarantees are asserted against TrailerModal here.
const video: TmdbVideo = {
  id: 'v',
  key: 'aqz-KE-bpKQ',
  name: 'Official Trailer',
  site: 'YouTube',
  type: 'Trailer',
  official: true,
};

function Screen() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Play trailer
      </button>
      {open && <TrailerModal video={video} title="Bravo" poster="" onClose={() => setOpen(false)} />}
    </>
  );
}

describe('TrailerModal dialog a11y', () => {
  it('is a labelled modal dialog that traps focus, closes on Escape and restores focus', () => {
    render(<Screen />);
    const opener = screen.getByRole('button', { name: 'Play trailer' });
    act(() => opener.focus());
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Official Trailer' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = screen.getByRole('button', { name: 'Close trailer' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
