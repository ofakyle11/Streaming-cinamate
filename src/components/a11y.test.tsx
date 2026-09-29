import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Movie } from '../services';
import DetailModal from './DetailModal';
import Row from './Row';

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

function Screen() {
  const [selected, setSelected] = useState<Movie | null>(null);
  return (
    <>
      <Row title="Trending" items={items} onSelect={setSelected} />
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

describe('Row keyboard navigation', () => {
  it('exposes a labelled region with one tab stop and arrow-key movement', () => {
    render(<Screen />);
    expect(screen.getByRole('region', { name: 'Trending' })).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: /Alpha|Bravo|Charlie/ });
    expect(cards.map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    act(() => cards[0].focus());
    fireEvent.keyDown(cards[0], { key: 'ArrowRight' });
    expect(cards[1]).toHaveFocus();
    fireEvent.keyDown(cards[1], { key: 'End' });
    expect(cards[2]).toHaveFocus();
  });
});

describe('DetailModal', () => {
  it('is a labelled modal dialog that traps focus, closes on Escape and restores focus', () => {
    render(<Screen />);
    const card = screen.getByRole('button', { name: /Bravo/ });
    act(() => card.focus());
    fireEvent.click(card);

    const dialog = screen.getByRole('dialog', { name: 'Bravo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = screen.getByRole('button', { name: 'Close details' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'My List' })).toHaveFocus();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });
});
